using Microsoft.AspNetCore.Mvc;
using TripWire.WebApi.Models;
using TripWire.WebApi.Storage;

namespace TripWire.WebApi.Controllers;

[ApiController]
[Route("api/trackers")]
public class TrackersController : ControllerBase
{
    private readonly JsonStore<TrackerFile> _store;

    public TrackersController(JsonStore<TrackerFile> store) => _store = store;

    [HttpGet]
    public async Task<IEnumerable<Tracker>> List()
        => (await _store.ReadAsync()).Trackers;

    [HttpGet("{id}")]
    public async Task<ActionResult<Tracker>> Get(string id)
    {
        var file = await _store.ReadAsync();
        var tracker = file.Trackers.FirstOrDefault(t => t.Id == id);
        return tracker is null ? NotFound() : tracker;
    }

    [HttpPost]
    public async Task<ActionResult<Tracker>> Create([FromBody] Tracker tracker)
    {
        if (string.IsNullOrWhiteSpace(tracker.Id))
            return BadRequest("id is required");

        var conflict = false;
        await _store.UpdateAsync(file =>
        {
            if (file.Trackers.Any(t => t.Id == tracker.Id)) conflict = true;
            else file.Trackers.Add(tracker);
            return Task.CompletedTask;
        });

        return conflict
            ? Conflict($"Tracker '{tracker.Id}' already exists.")
            : CreatedAtAction(nameof(Get), new { id = tracker.Id }, tracker);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Tracker>> Update(string id, [FromBody] Tracker tracker)
    {
        tracker.Id = id;
        var found = false;
        await _store.UpdateAsync(file =>
        {
            var idx = file.Trackers.FindIndex(t => t.Id == id);
            if (idx >= 0) { file.Trackers[idx] = tracker; found = true; }
            return Task.CompletedTask;
        });
        return found ? Ok(tracker) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var removed = 0;
        await _store.UpdateAsync(file =>
        {
            removed = file.Trackers.RemoveAll(t => t.Id == id);
            return Task.CompletedTask;
        });
        return removed > 0 ? NoContent() : NotFound();
    }
}
