using Microsoft.AspNetCore.Mvc;
using TripWire.WebApi.Models;
using TripWire.WebApi.Storage;

namespace TripWire.WebApi.Controllers;

[ApiController]
[Route("api/trackers")]
public class TrackersController : CrudController<TrackerFile, Tracker>
{
    public TrackersController(JsonStore<TrackerFile> store) : base(store) { }

    protected override List<Tracker> Items(TrackerFile file) => file.Trackers;
    protected override string IdOf(Tracker item) => item.Id;
    protected override void SetId(Tracker item, string id) => item.Id = id;
}
