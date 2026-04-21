using System.Text.Json;

namespace TripWire.WebApi.Models;

public class Rule
{
    public List<string> SelectorNames { get; set; } = new();

    // threshold | contains | changed
    public string Type { get; set; } = "";

    // > < >= <= == !=   (only for threshold)
    public string? Operator { get; set; }

    // string | number | boolean depending on Type
    public JsonElement? Value { get; set; }

    public string? TriggerAction { get; set; }
    public string? Message { get; set; }
}
