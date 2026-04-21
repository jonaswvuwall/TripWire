using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using AngleSharp.Html.Parser;
using TripWire.WebApi.Models;

namespace TripWire.WebApi.Services;

public record SelectorValue(string Name, string? Value);

public record RuleEvaluation(
    int RuleIndex,
    Rule Rule,
    string? MatchedSelector,
    object? PreviousValue,
    object? CurrentValue);

public class ContentAnalyzer
{
    private readonly HtmlParser _parser = new();

    // key "trackerId|selectorName" -> last observed value
    private readonly ConcurrentDictionary<string, string?> _lastValues = new();

    // key "trackerId|ruleIndex" -> whether the rule was triggered on the previous tick
    private readonly ConcurrentDictionary<string, bool> _lastTriggered = new();

    public List<SelectorValue> Extract(string html, IEnumerable<Selector> selectors)
    {
        var doc = _parser.ParseDocument(html);
        var results = new List<SelectorValue>();
        foreach (var s in selectors)
        {
            string? text = null;
            try
            {
                var node = doc.QuerySelector(s.Element);
                text = node?.TextContent.Trim();
            }
            catch
            {
                // invalid CSS selector -> value is null
            }
            results.Add(new SelectorValue(s.Name, text));
        }
        return results;
    }

    public List<RuleEvaluation> Evaluate(Tracker tracker, List<SelectorValue> values)
    {
        var byName = values.ToDictionary(v => v.Name, v => v);
        var hits = new List<RuleEvaluation>();

        for (int i = 0; i < tracker.Rules.Count; i++)
        {
            var rule = tracker.Rules[i];
            RuleEvaluation? match = null;

            foreach (var selName in rule.SelectorNames)
            {
                if (!byName.TryGetValue(selName, out var sv)) continue;
                var lastKey = $"{tracker.Id}|{selName}";
                _lastValues.TryGetValue(lastKey, out var previous);

                if (MatchesRule(rule, sv.Value, previous))
                {
                    match = new RuleEvaluation(i, rule, selName, previous, sv.Value);
                    break;
                }
            }

            var triggeredKey = $"{tracker.Id}|{i}";
            var wasTriggered = _lastTriggered.TryGetValue(triggeredKey, out var prev) && prev;
            var nowTriggered = match != null;

            // edge-trigger: only emit on false->true transition.
            // 'changed' is itself edge-like, so emit every time the condition matches.
            if (nowTriggered && (!wasTriggered || rule.Type == "changed"))
            {
                hits.Add(match!);
            }

            _lastTriggered[triggeredKey] = nowTriggered;
        }

        // persist current values for next tick (AFTER evaluation so 'changed' saw the previous value)
        foreach (var v in values)
        {
            _lastValues[$"{tracker.Id}|{v.Name}"] = v.Value;
        }

        return hits;
    }

    private static bool MatchesRule(Rule rule, string? current, string? previous)
    {
        switch (rule.Type)
        {
            case "threshold":
                {
                    if (current == null || rule.Operator == null || rule.Value == null) return false;
                    if (!TryParseNumber(current, out var cur)) return false;
                    if (!TryExtractNumber(rule.Value.Value, out var target)) return false;
                    return rule.Operator switch
                    {
                        ">" => cur > target,
                        "<" => cur < target,
                        ">=" => cur >= target,
                        "<=" => cur <= target,
                        "==" => cur == target,
                        "!=" => cur != target,
                        _ => false
                    };
                }
            case "contains":
                {
                    if (current == null || rule.Value == null) return false;
                    var needle = ExtractString(rule.Value.Value);
                    return !string.IsNullOrEmpty(needle)
                        && current.Contains(needle, StringComparison.OrdinalIgnoreCase);
                }
            case "changed":
                {
                    // first observation does not count as a change
                    if (previous == null) return false;
                    return current != previous;
                }
            default:
                return false;
        }
    }

    private static bool TryParseNumber(string s, out double value)
    {
        // strip common currency/whitespace noise for simple cases
        var cleaned = new string(s.Where(c => char.IsDigit(c) || c == '.' || c == ',' || c == '-').ToArray());
        // if both separators appear, assume '.' is thousands and ',' is decimal (common in DE)
        if (cleaned.Contains('.') && cleaned.Contains(','))
            cleaned = cleaned.Replace(".", "").Replace(',', '.');
        else
            cleaned = cleaned.Replace(',', '.');
        return double.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out value);
    }

    private static bool TryExtractNumber(JsonElement el, out double value)
    {
        value = 0;
        switch (el.ValueKind)
        {
            case JsonValueKind.Number:
                return el.TryGetDouble(out value);
            case JsonValueKind.String:
                return double.TryParse(el.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out value);
            default:
                return false;
        }
    }

    private static string? ExtractString(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.GetRawText(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        _ => null
    };
}
