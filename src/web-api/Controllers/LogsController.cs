using Microsoft.AspNetCore.Mvc;
using TripWire.WebApi.Models;
using TripWire.WebApi.Storage;

namespace TripWire.WebApi.Controllers;

[ApiController]
[Route("api/logs")]
public class LogsController : ControllerBase
{
    private readonly JsonStore<LogFile> _store;

    public LogsController(JsonStore<LogFile> store) => _store = store;

    [HttpGet]
    public async Task<IEnumerable<LogEntry>> List(
        [FromQuery] string? trackerId = null,
        [FromQuery] string? level = null,
        [FromQuery] int limit = 200)
    {
        var file = await _store.ReadAsync();
        IEnumerable<LogEntry> query = file.Entries;

        if (!string.IsNullOrWhiteSpace(trackerId))
            query = query.Where(e => e.Context?.TrackerId == trackerId);

        if (!string.IsNullOrWhiteSpace(level))
            query = query.Where(e => string.Equals(e.Level, level, StringComparison.OrdinalIgnoreCase));

        return query
            .OrderByDescending(e => e.Timestamp)
            .Take(Math.Clamp(limit, 1, 10_000));
    }

    [HttpDelete]
    public async Task<IActionResult> Clear()
    {
        await _store.UpdateAsync(file =>
        {
            file.Entries.Clear();
            return Task.CompletedTask;
        });
        return NoContent();
    }
}
