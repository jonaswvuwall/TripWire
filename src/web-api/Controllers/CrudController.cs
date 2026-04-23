using Microsoft.AspNetCore.Mvc;
using TripWire.WebApi.Storage;

namespace TripWire.WebApi.Controllers;

public abstract class CrudController<TFile, TItem> : ControllerBase
    where TFile : class
    where TItem : class
{
    private readonly JsonStore<TFile> _store;

    protected CrudController(JsonStore<TFile> store) => _store = store;

    protected abstract List<TItem> Items(TFile file);
    protected abstract string IdOf(TItem item);
    protected abstract void SetId(TItem item, string id);

    [HttpGet]
    public async Task<IEnumerable<TItem>> List()
        => Items(await _store.ReadAsync());

    [HttpGet("{id}")]
    public async Task<ActionResult<TItem>> Get(string id)
    {
        var item = Items(await _store.ReadAsync()).FirstOrDefault(i => IdOf(i) == id);
        return item is null ? NotFound() : item;
    }

    [HttpPost]
    public async Task<ActionResult<TItem>> Create([FromBody] TItem item)
    {
        if (string.IsNullOrWhiteSpace(IdOf(item)))
            return BadRequest("id is required");

        var conflict = false;
        await _store.UpdateAsync(file =>
        {
            var list = Items(file);
            if (list.Any(x => IdOf(x) == IdOf(item))) conflict = true;
            else list.Add(item);
            return Task.CompletedTask;
        });

        return conflict
            ? Conflict($"Item '{IdOf(item)}' already exists.")
            : CreatedAtAction(nameof(Get), new { id = IdOf(item) }, item);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TItem>> Update(string id, [FromBody] TItem item)
    {
        SetId(item, id);
        var found = false;
        await _store.UpdateAsync(file =>
        {
            var list = Items(file);
            var idx = list.FindIndex(x => IdOf(x) == id);
            if (idx >= 0) { list[idx] = item; found = true; }
            return Task.CompletedTask;
        });
        return found ? Ok(item) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var removed = 0;
        await _store.UpdateAsync(file =>
        {
            removed = Items(file).RemoveAll(x => IdOf(x) == id);
            return Task.CompletedTask;
        });
        return removed > 0 ? NoContent() : NotFound();
    }
}
