using System.Collections.Concurrent;
using TripWire.WebApi.Models;
using TripWire.WebApi.Storage;

namespace TripWire.WebApi.Services;

public class TrackerWorker : BackgroundService
{
    private const int MaxLogEntries = 10_000;

    private readonly IHttpClientFactory _httpFactory;
    private readonly JsonStore<TrackerFile> _trackerStore;
    private readonly JsonStore<ActionFile> _actionStore;
    private readonly JsonStore<LogFile> _logStore;
    private readonly ContentAnalyzer _analyzer;
    private readonly ActionExecutor _executor;
    private readonly ILogger<TrackerWorker> _logger;

    private readonly ConcurrentDictionary<string, DateTime> _lastPoll = new();
    private readonly ConcurrentDictionary<string, byte> _inFlight = new();

    public TrackerWorker(
        IHttpClientFactory httpFactory,
        JsonStore<TrackerFile> trackerStore,
        JsonStore<ActionFile> actionStore,
        JsonStore<LogFile> logStore,
        ContentAnalyzer analyzer,
        ActionExecutor executor,
        ILogger<TrackerWorker> logger)
    {
        _httpFactory = httpFactory;
        _trackerStore = trackerStore;
        _actionStore = actionStore;
        _logStore = logStore;
        _analyzer = analyzer;
        _executor = executor;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("TrackerWorker started.");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TrackerWorker tick failed.");
            }
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
            }
            catch (TaskCanceledException) { }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        var cfg = await _trackerStore.ReadAsync();
        var now = DateTime.UtcNow;

        foreach (var tracker in cfg.Trackers)
        {
            if (string.IsNullOrWhiteSpace(tracker.Id) || string.IsNullOrWhiteSpace(tracker.Url))
                continue;

            var interval = Math.Max(1, tracker.IntervalSeconds);
            if (_lastPoll.TryGetValue(tracker.Id, out var last) && (now - last).TotalSeconds < interval)
                continue;

            // don't queue multiple passes if a tracker is slow
            if (!_inFlight.TryAdd(tracker.Id, 1)) continue;
            _lastPoll[tracker.Id] = now;

            _ = Task.Run(async () =>
            {
                try { await ProcessTrackerAsync(tracker, ct); }
                finally { _inFlight.TryRemove(tracker.Id, out _); }
            }, ct);
        }
    }

    private async Task ProcessTrackerAsync(Tracker tracker, CancellationToken ct)
    {
        try
        {
            var client = _httpFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("TripWire/1.0");

            var html = await client.GetStringAsync(tracker.Url, ct);
            var values = _analyzer.Extract(html, tracker.Selectors);
            var hits = _analyzer.Evaluate(tracker, values);

            if (hits.Count == 0)
            {
                _logger.LogDebug("Tracker {Id}: no rule triggered ({Count} values).", tracker.Id, values.Count);
                return;
            }

            var actionFile = await _actionStore.ReadAsync();

            foreach (var hit in hits)
            {
                var entry = new LogEntry
                {
                    Timestamp = DateTime.UtcNow,
                    Level = "EVT",
                    Message = string.IsNullOrWhiteSpace(hit.Rule.Message)
                        ? $"Rule '{hit.Rule.Type}' on '{hit.MatchedSelector}' triggered"
                        : hit.Rule.Message!,
                    Context = new LogContext
                    {
                        TrackerId = tracker.Id,
                        Selector = hit.MatchedSelector,
                        RuleType = hit.Rule.Type,
                        PreviousValue = hit.PreviousValue,
                        CurrentValue = hit.CurrentValue,
                        TriggeredAction = hit.Rule.TriggerAction
                    }
                };

                await AppendLogAsync(entry);

                if (!string.IsNullOrWhiteSpace(hit.Rule.TriggerAction))
                {
                    var action = actionFile.Actions.FirstOrDefault(a => a.Id == hit.Rule.TriggerAction);
                    if (action != null)
                        await _executor.ExecuteAsync(action, entry, ct);
                    else
                        _logger.LogWarning("Tracker {Id}: action '{ActionId}' not found.", tracker.Id, hit.Rule.TriggerAction);
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tracker {Id} failed: {Message}", tracker.Id, ex.Message);
            await AppendLogAsync(new LogEntry
            {
                Level = "ERR",
                Message = $"Tracker '{tracker.Id}' failed: {ex.Message}",
                Context = new LogContext { TrackerId = tracker.Id }
            });
        }
    }

    private Task AppendLogAsync(LogEntry entry)
    {
        return _logStore.UpdateAsync(file =>
        {
            file.Entries.Add(entry);
            if (file.Entries.Count > MaxLogEntries)
                file.Entries.RemoveRange(0, file.Entries.Count - MaxLogEntries);
            return Task.CompletedTask;
        });
    }
}
