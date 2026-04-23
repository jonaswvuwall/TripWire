namespace TripWire.WebApi.Models;

public class LogEntry
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public string Level { get; set; } = LogLevels.Info;

    public string Message { get; set; } = "";

    public LogContext? Context { get; set; }
}

public class LogContext
{
    public string? TrackerId { get; set; }
    public string? Selector { get; set; }
    public string? RuleType { get; set; }
    public object? PreviousValue { get; set; }
    public object? CurrentValue { get; set; }
    public string? TriggeredAction { get; set; }
}

public class LogFile
{
    public List<LogEntry> Entries { get; set; } = new();
}
