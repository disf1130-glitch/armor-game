using System.Drawing;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ArmorGame;

internal static class Program
{
    private const string Host = "armor.local";

    [STAThread]
    private static void Main()
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new GameForm());
    }

    private sealed class GameForm : Form
    {
        private static readonly Color Back = Color.FromArgb(18, 20, 26);
        private readonly WebView2 _web = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Back };

        public GameForm()
        {
            Text = "Armor Simulation";
            Width = 1400;
            Height = 900;
            MinimumSize = new Size(960, 640);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Back;
            WindowState = FormWindowState.Maximized;
            Controls.Add(_web);
        }

        // WebView2 инициализируем уже из UI-потока (STA), иначе RPC_E_CHANGED_MODE.
        protected override async void OnShown(EventArgs e)
        {
            base.OnShown(e);

            var root = AppContext.BaseDirectory;
            if (!File.Exists(Path.Combine(root, "index.html")))
            {
                MessageBox.Show("Не найден index.html рядом с программой.", "Armor Game");
                Close();
                return;
            }

            var profile = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ArmorGame");
            Directory.CreateDirectory(profile);

            try
            {
                var env = await CoreWebView2Environment.CreateAsync(null, profile);
                await _web.EnsureCoreWebView2Async(env);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Не удалось запустить WebView2 (нужен Microsoft Edge WebView2 Runtime).\n\n" + ex.Message,
                    "Armor Game");
                Close();
                return;
            }

            // Игра идёт на виртуальный хост, а не по file:// — иначе не работает localStorage (сохранения).
            _web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                Host, root, CoreWebView2HostResourceAccessKind.DenyCors);
            _web.CoreWebView2.Settings.AreDevToolsEnabled = true;
            _web.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _web.Source = new Uri($"https://{Host}/index.html");
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) _web.Dispose();
            base.Dispose(disposing);
        }
    }
}