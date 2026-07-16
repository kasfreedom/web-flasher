import "./styles.css";
import {
  Cpu,
  BadgeCheck,
  File,
  FileLock,
  FileUp,
  Globe2,
  LockKeyhole,
  MapPin,
  PlugZap,
  ShieldCheck,
  Send,
  Terminal,
  Trash2,
  Usb,
  Zap,
  createIcons,
} from "lucide";
import { EsptoolFlasherClient } from "./flasher/EsptoolFlasherClient";
import { AppController } from "./ui/AppController";

const serialSupported = "serial" in navigator;
const secureContext = window.isSecureContext;

new AppController({
  root: document,
  flasher: new EsptoolFlasherClient(),
  serialSupported,
  secureContext,
}).start();

createIcons({
  icons: {
    Cpu,
    BadgeCheck,
    File,
    FileLock,
    FileUp,
    Globe2,
    LockKeyhole,
    MapPin,
    PlugZap,
    ShieldCheck,
    Send,
    Terminal,
    Trash2,
    Usb,
    Zap,
  },
});
