using System.Net.Http.Json;
using TripWire.WebApi.Models;

namespace TripWire.WebApi.Services;

public class ActionExecutor
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<ActionExecutor> _logger;

    public ActionExecutor(IHttpClientFactory httpFactory, ILogger<ActionExecutor> logger)
    {
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public async Task ExecuteAsync(TrackerAction action, LogEntry triggeringLog, CancellationToken ct = default)
    {
        switch (action.Type)
        {
            case "webhook":
            case "api-request":
                await SendHttpAsync(action, triggeringLog, ct);
                break;
            case "log":
                _logger.LogInformation("Action {Id} (log): {Message}", action.Id, triggeringLog.Message);
                break;
            case "script":
                _logger.LogWarning("Action {Id}: type 'script' is not implemented in the PoC.", action.Id);
                break;
            default:
                _logger.LogWarning("Action {Id}: unknown type '{Type}'.", action.Id, action.Type);
                break;
        }
    }

    private async Task SendHttpAsync(TrackerAction action, LogEntry triggeringLog, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(action.Url))
        {
            _logger.LogWarning("Action {Id}: url is missing, skipping.", action.Id);
            return;
        }

        var client = _httpFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        var method = new HttpMethod((action.Method ?? "POST").ToUpperInvariant());

        using var request = new HttpRequestMessage(method, action.Url);

        if (method != HttpMethod.Get && method != HttpMethod.Delete)
        {
            request.Content = JsonContent.Create(triggeringLog);
        }

        if (action.Headers != null)
        {
            foreach (var (k, v) in action.Headers)
            {
                if (!request.Headers.TryAddWithoutValidation(k, v))
                    request.Content?.Headers.TryAddWithoutValidation(k, v);
            }
        }

        try
        {
            using var response = await client.SendAsync(request, ct);
            _logger.LogInformation("Action {Id} -> {Status} ({Url})", action.Id, (int)response.StatusCode, action.Url);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Action {Id} failed: {Message}", action.Id, ex.Message);
        }
    }
}
