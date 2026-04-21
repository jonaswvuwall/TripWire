namespace TripWire.WebApi.Models;

public class Tracker
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public int IntervalSeconds { get; set; } = 60;
    public List<Selector> Selectors { get; set; } = new();
    public List<Rule> Rules { get; set; } = new();
}

public class TrackerFile
{
    public List<Tracker> Trackers { get; set; } = new();
}
