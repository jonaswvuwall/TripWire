using Microsoft.AspNetCore.Mvc;
using TripWire.WebApi.Models;
using TripWire.WebApi.Storage;

namespace TripWire.WebApi.Controllers;

[ApiController]
[Route("api/actions")]
public class ActionsController : ControllerBase
{
    private readonly JsonStore<ActionFile> _store;

    public ActionsController(JsonStore<ActionFile> store) => _store = store;

    [HttpGet]
    public async Task<IEnumerable<TrackerAction>> List()
        => (await _store.ReadAsync()).Actions;

    [HttpGet("{id}")]
    public async Task<ActionResult<TrackerAction>> Get(string id)
    {
        var file = await _store.ReadAsync();
        var action = file.Actions.FirstOrDefault(a => a.Id == id);
        return action is null ? NotFound() : action;
    }

    [HttpPost]
    public async Task<ActionResult<TrackerAction>> Create([FromBody] TrackerAction action)
    {
        if (string.IsNullOrWhiteSpace(action.Id))
            return BadRequest("id is required");

        var conflict = false;
        await _store.UpdateAsync(file =>
        {
            if (file.Actions.Any(a => a.Id == action.Id)) conflict = true;
            else file.Actions.Add(action);
            return Task.CompletedTask;
        });

        return conflict
            ? Conflict($"Action '{action.Id}' already exists.")
            : CreatedAtAction(nameof(Get), new { id = action.Id }, action);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TrackerAction>> Update(string id, [FromBody] TrackerAction action)
    {
        action.Id = id;
        var found = false;
        await _store.UpdateAsync(file =>
        {
            var idx = file.Actions.FindIndex(a => a.Id == id);
            if (idx >= 0) { file.Actions[idx] = action; found = true; }
            return Task.CompletedTask;
        });
        return found ? Ok(action) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var removed = 0;
        await _store.UpdateAsync(file =>
        {
            removed = file.Actions.RemoveAll(a => a.Id == id);
            return Task.CompletedTask;
        });
        return removed > 0 ? NoContent() : NotFound();
    }
}
