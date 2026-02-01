const { Gio } = imports.gi;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;


let refreshItem;
let networkMenu;
let menuSignalId = null;

function execAsync(cmd) {
    Gio.Subprocess.new(
        ["bash", "-c", cmd],
        Gio.SubprocessFlags.NONE
    );
}

// Rescan Wi-Fi + auto-connect to strongest known network
function autoConnectKnownWifi() {
    execAsync(`
        nmcli device wifi rescan;
        sleep 1;
        BEST=$(nmcli -t -f NAME,DEVICE connection show --active | head -n1 | cut -d: -f1);
        if [ -n "$BEST" ]; then
            nmcli connection up "$BEST";
        else
            nmcli device wifi connect "$(nmcli -t -f NAME connection show | head -n1)";
        fi
    `);
}

function insertRefreshButton() {
    if (!networkMenu) return;

    // Avoid duplicates
    let items = networkMenu._getMenuItems();
    for (let item of items) {
        if (item._isWifiRefreshButton) return;
    }

    // ✅ GNOME-native item with perfect icon alignment
    refreshItem = new PopupMenu.PopupImageMenuItem(
        "Refresh Network",
        "view-refresh-symbolic"
    );
    
    refreshItem._isWifiRefreshButton = true;

    refreshItem.connect("activate", autoConnectKnownWifi);

    // ✅ Find correct insertion position (under Wi-Fi header)
    let insertIndex = 0;
    for (let i = 0; i < items.length; i++) {
        if (items[i].label && items[i].label.text.includes("Select")) {
            insertIndex = i;
            break;
        }
    }

    networkMenu.addMenuItem(refreshItem, insertIndex);
}

function enable() {
    let network = Main.panel.statusArea.aggregateMenu._network;
    if (!network) {
        log("❌ Wi-Fi menu not found");
        return;
    }

    networkMenu = network.menu;

    // GNOME rebuilds menu dynamically → inject button every time menu opens
    menuSignalId = networkMenu.connect("open-state-changed", (menu, open) => {
        if (open) {
            if (refreshItem) {
                refreshItem.destroy();
                refreshItem = null;
            }
            insertRefreshButton();
        }
    });
}

function disable() {
    if (refreshItem) {
        refreshItem.destroy();
        refreshItem = null;
    }

    if (networkMenu && menuSignalId) {
        networkMenu.disconnect(menuSignalId);
        menuSignalId = null;
    }
}

