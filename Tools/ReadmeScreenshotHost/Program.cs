// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0

// A disposable screenshot-only host. It uses the actual backend, embedded web server and
// simulator, but replaces module UDP with a no-op implementation: generating documentation
// must never send steering, section or configuration packets to real equipment.
using System.Net;
using System.Reflection;
using AgOpenWeb.Desktop.DependencyInjection;
using AgOpenWeb.Models.Configuration;
using AgOpenWeb.Models.State;
using AgOpenWeb.RemoteServer;
using AgOpenWeb.RemoteWiring;
using AgOpenWeb.Services;
using AgOpenWeb.Services.Interfaces;
using AgOpenWeb.Services.Threading;
using AgOpenWeb.ViewModels;
using Microsoft.Extensions.DependencyInjection;

if (Environment.GetEnvironmentVariable("AGOPENWEB_SCREENSHOT_HOST") != "1"
    || string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AGOPENWEB_DATA"))
    || args.Length != 2 || !int.TryParse(args[0], out int port) || port < 1024 || port > 65535
    || args[1].Length != 32 || !args[1].All(c => char.IsAsciiHexDigit(c)))
{
    Console.Error.WriteLine("Use the screenshot generator: it supplies an isolated data root and port.");
    return 2;
}

using var loop = new HostLoopDispatcher();
var services = new ServiceCollection();
services.AddAgOpenWebServices();
// Last registration wins: none of the real module sockets or network discovery are used.
services.AddSingleton<IUdpCommunicationService, ScreenshotUdp>();
services.AddSingleton<ILocalNetworkInfoProvider, ScreenshotNetwork>();
services.AddSingleton(loop);
services.AddSingleton<IUiDispatcher>(loop);
services.AddSingleton<IUiTimerFactory>(loop);
using var sp = services.BuildServiceProvider();

sp.GetRequiredService<ISettingsService>().Load();
var config = sp.GetRequiredService<IConfigurationService>();
config.LoadAppSettings();
sp.GetRequiredService<IPersistentStateService>().Load();
var vm = sp.GetRequiredService<MainViewModel>();
var server = new RemoteServerHost();
await server.StartAsync(
    sp.GetRequiredService<ApplicationState>(), sp.GetRequiredService<ICoverageMapService>(),
    sp.GetRequiredService<ISectionControlService>(), sp.GetRequiredService<IToolPositionService>(),
    sp.GetRequiredService<ConfigurationStore>(), sp.GetRequiredService<IJobService>(), config,
    sp.GetRequiredService<IAutoSteerService>(), sp.GetRequiredService<ISmartWasCalibrationService>(),
    sp.GetRequiredService<IUdpCommunicationService>(), sp.GetRequiredService<INtripProfileService>(),
    sp.GetRequiredService<IFieldService>(), sp.GetRequiredService<ISettingsService>(),
    sp.GetRequiredService<IVehicleProfileService>(), sp.GetRequiredService<IPersistentStateService>(),
    sp.GetService<INtripClientService>(), port);

var wired = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
loop.Post(() =>
{
    try { RemoteServerWiring.Wire(server, vm, sp, config, new NoImagery()); wired.SetResult(); }
    catch (Exception ex) { wired.SetException(ex); }
});
await wired.Task;

// SimpleWebServer binds all interfaces and on Windows can share a port with a listener bound
// to loopback. A successful bind alone does not prove that the browser reaches this process.
// Give the screenshot host a per-run identity endpoint and a secret WebSocket path. The browser
// must verify the identity before loading the UI, and its transport is redirected to the secret
// path: an unrelated AgOpenWeb instance will never receive a control connection or command.
// These fields are deliberately accessed only in this test helper; if upstream renames them,
// fail closed instead of changing the production host or silently falling back to /ws.
const BindingFlags privateInstance = BindingFlags.Instance | BindingFlags.NonPublic;
var web = typeof(RemoteServerHost).GetField("_server", privateInstance)?.GetValue(server) as SimpleWebServer
    ?? throw new InvalidOperationException("Screenshot host cannot install its identity endpoint.");
var hub = typeof(RemoteServerHost).GetField("_ws", privateInstance)?.GetValue(server) as WebSocketHub
    ?? throw new InvalidOperationException("Screenshot host cannot isolate its WebSocket path.");
string nonce = args[1];
web.MapGet("/__readme_screenshot_host", () => SimpleWebServer.Response.Text(nonce, "text/plain"));
web.MapWebSocket("/__readme_ws_" + nonce, (socket, from, ct) => hub.HandleAsync(socket, ct, from));
Console.WriteLine($"SCREENSHOT_HOST_READY {port}");
await Task.Delay(Timeout.Infinite);
return 0;

// No module sockets, broadcasts, loopback datagrams, or simulated module replies.
sealed class ScreenshotUdp : IUdpCommunicationService
{
    public event EventHandler<UdpDataReceivedEventArgs>? DataReceived { add { } remove { } }
    public event EventHandler<ModuleConnectionEventArgs>? ModuleConnectionChanged { add { } remove { } }
    public bool IsConnected => false;
    public bool IsTaskControllerHeard => false;
    public string? LocalIPAddress => null;
    public IReadOnlyList<string> GetLocalIpAddresses() => Array.Empty<string>();
    public Task StartAsync() => Task.CompletedTask;
    public Task StopAsync() => Task.CompletedTask;
    public void SendToModules(byte[] data) { }
    public void SendToLoopback(byte[] data) { }
    public void SendGpsDataToLoopback(byte[] data) { }
    public void SendToTaskController(byte[] data) { }
    public void SendHelloPacket() { }
    public bool IsModuleHelloOk(ModuleType moduleType) => false;
    public bool IsModuleDataOk(ModuleType moduleType) => false;
    public string? GetModuleIpAddress(ModuleType moduleType) => null;
    public string? GetModuleSubnet() => null;
    public string? GetScanReplySubnet() => null;
    public string? GetActiveModuleSubnet() => null;
    public IPAddress? GetGpsSourceAddress(double maxAgeSeconds = 10) => null;
    public void ScanModules() { }
    public void SetModuleSubnet(byte octet1, byte octet2, byte octet3) { }
}

sealed class ScreenshotNetwork : ILocalNetworkInfoProvider
{
    public IReadOnlyList<LocalNetworkAddress> GetIPv4Addresses() => Array.Empty<LocalNetworkAddress>();
}

sealed class NoImagery : IBoundaryImageryCapture
{
    public Task<bool> TryCaptureAsync(double mercMinX, double mercMaxX, double mercMinY,
        double mercMaxY, string outPath) => Task.FromResult(false);
}
