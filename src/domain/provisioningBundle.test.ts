import { describe, expect, it } from "vitest";
import { readProvisioningBundleFile, validateProvisioningBundleJson } from "./provisioningBundle";

const VALID_BUNDLE = {
  type: "provision",
  force: true,
  deviceId: "kairo-dev-03",
  thingName: "kairo-dev-03",
  awsIot: {
    endpoint: "a2rcuwgghnpqq6-ats.iot.us-east-1.amazonaws.com",
    credentialsEndpoint: "c2pqczdioiu1hx.credentials.iot.us-east-1.amazonaws.com",
    roleAlias: "kairo-device-role-alias",
  },
  audioIngest: {
    webSocketUrl: "wss://d2mo4d0qgju6vn.cloudfront.net/ingest",
    languageOptions: ["en-US", "de-DE"],
    sampleRateHz: 16000,
    audioFormat: "pcm16",
    returnTranscript: false,
  },
  certificates: {
    rootCaPem: "-----BEGIN CERTIFICATE-----\nroot\n-----END CERTIFICATE-----\n",
    deviceCertPem: "-----BEGIN CERTIFICATE-----\ndevice\n-----END CERTIFICATE-----\n",
    privateKeyPem: "-----BEGIN RSA PRIVATE KEY-----\nprivate\n-----END RSA PRIVATE KEY-----\n",
  },
};

describe("provisioningBundle", () => {
  it("accepts a valid bundle without Wi-Fi fields", () => {
    const { wifi: _wifi, ...bundleWithoutWifi } = {
      ...VALID_BUNDLE,
      wifi: { ssid: "wifi-name", password: "wifi-password" },
    };

    const result = validateProvisioningBundleJson(JSON.stringify(bundleWithoutWifi));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.deviceId).toBe("kairo-dev-03");
      expect(result.bundle.thingName).toBe("kairo-dev-03");
      expect(result.bundle.summary).toBe("kairo-dev-03 / kairo-dev-03");
      expect(JSON.parse(result.bundle.json)).toMatchObject({
        type: "provision",
        deviceId: "kairo-dev-03",
      });
    }
  });

  it("rejects missing required fields", () => {
    const invalidBundle = {
      ...VALID_BUNDLE,
      certificates: { ...VALID_BUNDLE.certificates, privateKeyPem: "" },
    };

    const result = validateProvisioningBundleJson(JSON.stringify(invalidBundle));

    expect(result).toEqual({
      ok: false,
      code: "invalid-provisioning-bundle",
      message: "Provisioning bundle is missing certificates.privateKeyPem.",
    });
  });

  it("rejects bundles with the wrong type", () => {
    const result = validateProvisioningBundleJson(JSON.stringify({ ...VALID_BUNDLE, type: "other" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('Provisioning bundle must set type to "provision".');
    }
  });

  it("reads selected JSON file metadata and canonical JSON", async () => {
    const file = new File([JSON.stringify(VALID_BUNDLE, null, 2)], "kairo-dev-03.json", {
      type: "application/json",
    });

    const result = await readProvisioningBundleFile(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.fileName).toBe("kairo-dev-03.json");
      expect(result.bundle.sizeBytes).toBe(file.size);
      expect(result.bundle.deviceId).toBe("kairo-dev-03");
      expect(result.bundle.json).toBe(JSON.stringify(VALID_BUNDLE));
    }
  });

  it("rejects missing and empty files", async () => {
    await expect(readProvisioningBundleFile(null)).resolves.toEqual({
      ok: false,
      code: "missing-provisioning-bundle",
      message: "Choose a provisioning JSON bundle from this computer.",
    });

    await expect(readProvisioningBundleFile(new File([], "empty.json"))).resolves.toEqual({
      ok: false,
      code: "empty-provisioning-bundle",
      message: "The selected provisioning bundle is empty.",
    });
  });
});
