using TripWire.WebApi.Models;
using TripWire.WebApi.Services;
using TripWire.WebApi.Storage;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(opt =>
    {
        opt.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opt.JsonSerializerOptions.WriteIndented = true;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHttpClient(HttpClients.Fetch, c =>
{
    c.Timeout = TimeSpan.FromSeconds(30);
    c.DefaultRequestHeaders.UserAgent.ParseAdd("TripWire/1.0");
});
builder.Services.AddHttpClient(HttpClients.Preview, c =>
{
    c.Timeout = TimeSpan.FromSeconds(30);
    c.DefaultRequestHeaders.UserAgent.ParseAdd("TripWire/1.0 (+element picker)");
});
builder.Services.AddHttpClient(HttpClients.Action, c =>
{
    c.Timeout = TimeSpan.FromSeconds(15);
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .AllowAnyOrigin()
    .AllowAnyHeader()
    .AllowAnyMethod()));

var dataDir = Path.Combine(builder.Environment.ContentRootPath, "Data");
Directory.CreateDirectory(dataDir);

builder.Services.AddSingleton(new JsonStore<TrackerFile>(Path.Combine(dataDir, "config.json"), () => new TrackerFile()));
builder.Services.AddSingleton(new JsonStore<ActionFile>(Path.Combine(dataDir, "actions.json"), () => new ActionFile()));
builder.Services.AddSingleton(new JsonStore<LogFile>(Path.Combine(dataDir, "logs.json"), () => new LogFile()));

builder.Services.AddSingleton<ContentAnalyzer>();
builder.Services.AddSingleton<ActionExecutor>();
builder.Services.AddHostedService<TrackerWorker>();

var app = builder.Build();

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();
