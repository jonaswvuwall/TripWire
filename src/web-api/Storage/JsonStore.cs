using System.Text.Json;

namespace TripWire.WebApi.Storage;

public class JsonStore<T> where T : class
{
    private readonly string _path;
    private readonly Func<T> _factory;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public JsonStore(string path, Func<T> factory)
    {
        _path = path;
        _factory = factory;
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
    }

    public async Task<T> ReadAsync()
    {
        await _lock.WaitAsync();
        try
        {
            return await LoadNoLockAsync();
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task WriteAsync(T value)
    {
        await _lock.WaitAsync();
        try
        {
            await WriteNoLockAsync(value);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task UpdateAsync(Func<T, Task> updater)
    {
        await _lock.WaitAsync();
        try
        {
            var current = await LoadNoLockAsync();
            await updater(current);
            await WriteNoLockAsync(current);
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<T> LoadNoLockAsync()
    {
        if (!File.Exists(_path))
        {
            var seed = _factory();
            await WriteNoLockAsync(seed);
            return seed;
        }
        var json = await File.ReadAllTextAsync(_path);
        if (string.IsNullOrWhiteSpace(json)) return _factory();
        return JsonSerializer.Deserialize<T>(json, Options) ?? _factory();
    }

    private async Task WriteNoLockAsync(T value)
    {
        var json = JsonSerializer.Serialize(value, Options);
        var tmp = _path + ".tmp";
        await File.WriteAllTextAsync(tmp, json);
        File.Move(tmp, _path, overwrite: true);
    }
}
