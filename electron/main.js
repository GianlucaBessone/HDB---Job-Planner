const { app, BrowserWindow } = require('electron');
const path = require('path');
const portfinder = require('portfinder');

let mainWindow;

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/images/android/launchericon-512x512.png')
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  if (!app.isPackaged) {
    // Modo de desarrollo: asumimos que npm run dev corre Next.js en el puerto 3000
    createWindow(3000).then(() => {
      if (mainWindow) {
        mainWindow.webContents.openDevTools();
      }
    });
  } else {
    // Modo producción (empaquetado)
    try {
      const port = await portfinder.getPortPromise({ port: 3000 });
      const { startServer } = require('./server');
      
      const appPath = app.getAppPath();
      
      // Iniciamos el servidor de Next programáticamente para tener soporte total (incluye API routes y Prisma)
      await startServer(port, appPath);
      
      createWindow(port);
    } catch (err) {
      console.error('Error starting server:', err);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
