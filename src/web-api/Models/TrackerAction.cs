namespace TripWire.WebApi.Models;

public class TrackerAction
{
    public string Id { get; set; } = "";

    public string Type { get; set; } = "";

    public string? Method { get; set; }

    public string? Url { get; set; }

    public Dictionary<string, string>? Headers { get; set; }
}

public class ActionFile
{
    public List<TrackerAction> Actions { get; set; } = new();
}
