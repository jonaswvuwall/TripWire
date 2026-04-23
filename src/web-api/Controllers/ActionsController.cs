using Microsoft.AspNetCore.Mvc;
using TripWire.WebApi.Models;
using TripWire.WebApi.Storage;

namespace TripWire.WebApi.Controllers;

[ApiController]
[Route("api/actions")]
public class ActionsController : CrudController<ActionFile, TrackerAction>
{
    public ActionsController(JsonStore<ActionFile> store) : base(store) { }

    protected override List<TrackerAction> Items(ActionFile file) => file.Actions;
    protected override string IdOf(TrackerAction item) => item.Id;
    protected override void SetId(TrackerAction item, string id) => item.Id = id;
}
