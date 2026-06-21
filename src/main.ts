import "./styles.css";
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
