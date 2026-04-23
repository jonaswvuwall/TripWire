namespace TripWire.WebApi.Models;

public static class RuleTypes
{
    public const string Threshold = "threshold";
    public const string Contains = "contains";
    public const string Changed = "changed";
}

public static class ActionTypes
{
    public const string ApiRequest = "api-request";
    public const string Log = "log";
    public const string Script = "script";
}

public static class LogLevels
{
    public const string Event = "EVT";
    public const string Info = "INFO";
    public const string Warn = "WARN";
    public const string Error = "ERR";
    public const string Debug = "DEBUG";
}
