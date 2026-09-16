import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Archive,
  Check,
  CloudUpload,
  Download,
  FileImage,
  ImagePlus,
  LayoutDashboard,
  Menu,
  Moon,
  PanelRight,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
type PresetKey =
  | "original"
  | "square"
  | "portrait"
  | "story"
  | "4k-square"
  | "4k-portrait"
  | "4k-landscape";
type Settings = {
  logoData: string;
  companyName: string;
  position: Position;
  size: number;
  opacity: number;
  margin: number;
  rotation: number;
  preset: PresetKey;
  jpgQuality: number;
};
type ImageItem = {
  id: string;
  name: string;
  file: File;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  processed?: string;
  status: "ready" | "processing" | "done" | "error";
};
type Preset = {
  key: PresetKey;
  label: string;
  size: string;
  width?: number;
  height?: number;
  ratio?: number;
  is4k?: boolean;
};

const defaultLogo = "/assets/water mark png.png";
const defaultLogoAssetPath = "/assets/Absara LOGO 1.png";
const maxFileSize = 100 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const defaultSettings: Settings = {
  logoData: defaultLogo,
  companyName: "ABSARA BEAUTY PARLOUR & ACADEMY",
  position: "bottom-right",
  size: 15,
  opacity: 85,
  margin: 4,
  rotation: 0,
  preset: "original",
  jpgQuality: 95,
};
const positions: Position[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
const presets: Preset[] = [
  {
    key: "square",
    label: "Instagram Square",
    size: "1080 x 1080",
    width: 1080,
    height: 1080,
    ratio: 1,
  },
  {
    key: "portrait",
    label: "Instagram Portrait",
    size: "1080 x 1350",
    width: 1080,
    height: 1350,
    ratio: 1080 / 1350,
  },
  {
    key: "story",
    label: "Instagram Story",
    size: "1080 x 1920",
    width: 1080,
    height: 1920,
    ratio: 1080 / 1920,
  },
  {
    key: "4k-square",
    label: "4K Square",
    size: "3840 x 3840",
    width: 3840,
    height: 3840,
    ratio: 1,
    is4k: true,
  },
  {
    key: "4k-portrait",
    label: "4K Portrait",
    size: "2160 x 3840",
    width: 2160,
    height: 3840,
    ratio: 2160 / 3840,
    is4k: true,
  },
  {
    key: "4k-landscape",
    label: "4K Landscape",
    size: "3840 x 2160",
    width: 3840,
    height: 2160,
    ratio: 3840 / 2160,
    is4k: true,
  },
  { key: "original", label: "Original Size", size: "Original size" },
];

function readSettings(): Settings {
  try {
    const saved = JSON.parse(
      localStorage.getItem("absara-watermark-settings") || "{}",
    );
    return {
      ...defaultSettings,
      ...saved,
      logoData:
        saved.logoData === "/water mark png.png" ||
        saved.logoData === "/UI/water mark png.png" ||
        saved.logoData === "water mark png.png"
          ? defaultLogo
          : saved.logoData || defaultLogo,
    };
  } catch {
    return defaultSettings;
  }
}
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      console.error(`Default watermark asset failed to load: ${src}`);
      reject(new Error(`Failed to load image asset: ${src}`));
    };
    image.src = src;
  });
}
function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function bytes(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function ratio(width: number, height: number) {
  return `${(width / height).toFixed(2)}:1`;
}
function watermarkSize(width: number, logo: HTMLImageElement, scale: number) {
  const watermarkWidth = (width * scale) / 100;
  return {
    width: watermarkWidth,
    height: (watermarkWidth * logo.naturalHeight) / logo.naturalWidth,
  };
}
function watermarkPosition(
  position: Position,
  width: number,
  height: number,
  logoWidth: number,
  logoHeight: number,
  margin: number,
) {
  return {
    x: position.includes("right")
      ? width - (width * margin) / 100 - logoWidth
      : position.includes("left")
        ? (width * margin) / 100
        : (width - logoWidth) / 2,
    y: position.includes("bottom")
      ? height - (height * margin) / 100 - logoHeight
      : position.includes("top")
        ? (height * margin) / 100
        : (height - logoHeight) / 2,
  };
}
function calculate4kDimensions(width: number, height: number) {
  const aspectRatio = width / height;
  if (aspectRatio === 1) return { width: 3840, height: 3840 };
  if (aspectRatio > 1)
    return { width: 3840, height: Math.round(3840 / aspectRatio) };
  return { width: 2160, height: Math.round(2160 / aspectRatio) };
}

async function renderWatermark(
  image: ImageItem,
  settings: Settings,
  requestedPreset?: PresetKey,
) {
  const originalImage = await loadImage(image.url);
  const preset =
    presets.find(
      (entry) => entry.key === (requestedPreset || settings.preset),
    ) || presets[presets.length - 1];
  const is4k = Boolean(preset.is4k);
  const isInstagram = !is4k && preset.key !== "original";
  let cropWidth = originalImage.naturalWidth;
  let cropHeight = originalImage.naturalHeight;
  let cropX = 0;
  let cropY = 0;
  if (isInstagram && preset.ratio) {
    const sourceRatio =
      originalImage.naturalWidth / originalImage.naturalHeight;
    if (sourceRatio > preset.ratio) {
      cropWidth = originalImage.naturalHeight * preset.ratio;
      cropX = (originalImage.naturalWidth - cropWidth) / 2;
    } else {
      cropHeight = originalImage.naturalWidth / preset.ratio;
      cropY = (originalImage.naturalHeight - cropHeight) / 2;
    }
  }
  const dimensions = is4k
    ? calculate4kDimensions(
        originalImage.naturalWidth,
        originalImage.naturalHeight,
      )
    : {
        width:
          preset.key === "original"
            ? originalImage.naturalWidth
            : preset.width || 1080,
        height:
          preset.key === "original"
            ? originalImage.naturalHeight
            : preset.height ||
              Math.round(
                (preset.width || 1080) /
                  (preset.ratio ||
                    originalImage.naturalWidth / originalImage.naturalHeight),
              ),
      };
  const outputWidth = dimensions.width;
  const outputHeight = dimensions.height;
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (isInstagram)
    context.drawImage(
      originalImage,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );
  else context.drawImage(originalImage, 0, 0, outputWidth, outputHeight);
  const logo = await loadImage(settings.logoData || defaultLogo);
  const size = watermarkSize(canvas.width, logo, settings.size);
  const position = watermarkPosition(
    settings.position,
    canvas.width,
    canvas.height,
    size.width,
    size.height,
    settings.margin,
  );
  context.save();
  context.globalAlpha = settings.opacity / 100;
  context.translate(position.x + size.width / 2, position.y + size.height / 2);
  context.rotate((settings.rotation * Math.PI) / 180);
  context.drawImage(
    logo,
    -size.width / 2,
    -size.height / 2,
    size.width,
    size.height,
  );
  context.restore();
  return {
    dataUrl: canvas.toDataURL("image/png", 1),
    width: canvas.width,
    height: canvas.height,
  };
}

function App() {
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dark, setDark] = useState(
    () => localStorage.getItem("absara-theme") === "dark",
  );
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState("");
  const [setup, setSetup] = useState(
    () => !localStorage.getItem("absara-watermark-settings"),
  );
  const [confirmAll, setConfirmAll] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const selected = images.find((item) => item.id === selectedId) || images[0];
  const processed = images.filter((item) => item.status === "done").length;
  const update = (patch: Partial<Settings>) =>
    setSettings((current) => ({ ...current, ...patch }));
  const preset =
    presets.find((item) => item.key === settings.preset) ||
    presets[presets.length - 1];
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("absara-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!images.length) return;
    let cancelled = false;
    const process = async () => {
      setImages((current) =>
        current.map((item) => ({ ...item, status: "processing" })),
      );
      const result = await Promise.all(
        images.map(async (item) => {
          try {
            return {
              ...item,
              processed: (await renderWatermark(item, settings)).dataUrl,
              status: "done" as const,
            };
          } catch {
            return { ...item, status: "error" as const };
          }
        }),
      );
      if (!cancelled) setImages(result);
    };
    void process();
    return () => {
      cancelled = true;
    };
  }, [settings, images.length]);
  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    for (const file of files) {
      const fileTypeSupported =
        acceptedImageTypes.includes(file.type) ||
        /\.(jpe?g|png|webp)$/i.test(file.name);

      if (!fileTypeSupported) {
        rejectedFiles.push(file.name);
        continue;
      }

      if (file.size > maxFileSize) {
        rejectedFiles.push(file.name);
        continue;
      }

      validFiles.push(file);
    }

    if (!validFiles.length) {
      if (rejectedFiles.length > 0) {
        setNotice(
          "File is too large. Maximum allowed size is 100 MB per image.",
        );
      } else {
        setNotice("Please choose a JPG, JPEG, PNG, or WEBP image.");
      }
      return;
    }

    const added = await Promise.all(
      validFiles.map(async (file) => {
        const url = await fileToDataUrl(file);
        const natural = await loadImage(url);
        return {
          id: `${file.name}-${file.lastModified}-${Math.random()}`,
          name: file.name,
          file,
          url,
          naturalWidth: natural.naturalWidth,
          naturalHeight: natural.naturalHeight,
          status: "ready" as const,
        };
      }),
    );

    setImages((current) => [...current, ...added]);
    setSelectedId(added[0]?.id || null);
    setNotice("");
  };
  const removeImage = (id: string) => {
    setImages((current) => current.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    setNotice("Image removed from this workspace.");
  };
  const reset = () => {
    setImages([]);
    setSelectedId(null);
    setZoom(1);
    setSettings({ ...defaultSettings, logoData: settings.logoData });
    setNotice("Workspace reset. Your saved watermark logo was kept.");
  };
  const download = async (
    image: ImageItem,
    type: "png" | "jpg",
    requestedPreset?: PresetKey,
  ) => {
    const rendered = await renderWatermark(image, settings, requestedPreset);
    let href = rendered.dataUrl;
    if (type === "jpg") {
      const canvas = document.createElement("canvas");
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      const context = canvas.getContext("2d");
      const source = await loadImage(rendered.dataUrl);
      context?.drawImage(source, 0, 0);
      href = canvas.toDataURL("image/jpeg", settings.jpgQuality / 100);
    }
    const link = document.createElement("a");
    link.href = href;
    link.download = `${image.name.replace(/\.[^/.]+$/, "")}-watermarked.${type}`;
    link.click();
  };
  const downloadAll = async () => {
    const zip = new JSZip();
    for (const image of images) {
      const rendered = await renderWatermark(image, settings);
      zip.file(
        `${image.name.replace(/\.[^/.]+$/, "")}-watermarked.png`,
        rendered.dataUrl.split(",")[1],
        { base64: true },
      );
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "absara-watermarked-images.zip";
    link.click();
    URL.revokeObjectURL(url);
  };
  const chooseLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) update({ logoData: await fileToDataUrl(file) });
  };
  const outputDimensions = selected
    ? preset.is4k
      ? calculate4kDimensions(selected.naturalWidth, selected.naturalHeight)
      : {
          width:
            settings.preset === "original"
              ? selected.naturalWidth
              : preset.width || 1080,
          height:
            settings.preset === "original"
              ? selected.naturalHeight
              : preset.height || 0,
        }
    : { width: 0, height: 0 };
  const outputWidth = outputDimensions.width;
  const outputHeight = outputDimensions.height;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark-wrap">
            <img
              className="brand-mark"
              src={defaultLogoAssetPath}
              alt="ABSARA logo"
            />
          </div>
          <div className="brand-copy">
            <strong>ABSARA</strong>
          </div>
          <div className="brand-divider" aria-hidden="true">
            <span className="divider-line" />
            <span className="divider-mark">◆</span>
            <span className="divider-line" />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar navigation" />

      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu">
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <b>/</b>
            <strong>Dashboard</strong>
          </div>
          <div className="top-actions">
            <span className="status-pill">
              <span className="pulse" />
              All systems ready
            </span>
            <button className="icon-button" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <section className="content-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CREATIVE WORKSPACE</p>
              <h1>Make every image unmistakably yours.</h1>
              <p className="subheading">
                Upload your content and let your brand do the talking.
              </p>
            </div>
            <div className="head-actions">
              <button className="ghost-button" onClick={reset}>
                <SlidersHorizontal size={15} /> Reset
              </button>
              <button
                className="primary-button"
                onClick={() => uploadInput.current?.click()}
              >
                <ImagePlus size={18} /> Add images
              </button>
              <input
                ref={uploadInput}
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) =>
                  event.target.files && void addFiles(event.target.files)
                }
              />
            </div>
          </div>
          {notice && (
            <div className="notice">
              <Check size={16} />
              {notice}
              <button onClick={() => setNotice("")}>
                <X size={14} />
              </button>
            </div>
          )}
          <div className="dashboard-grid">
            <div className="workspace-column">
              <div
                className={`upload-zone ${dragging ? "dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event: DragEvent<HTMLDivElement>) => {
                  event.preventDefault();
                  setDragging(false);
                  void addFiles(event.dataTransfer.files);
                }}
                onClick={() => uploadInput.current?.click()}
              >
                <div className="upload-icon">
                  <CloudUpload size={26} />
                </div>
                <h2>Drop your images here</h2>
                <p>
                  or <span>browse from your computer</span>
                </p>
                <small>
                  JPG, PNG or WEBP • Up to 100 MB each • Multiple files supported
                </small>
              </div>
              <div className="section-head">
                <div>
                  <h3>
                    {images.length
                      ? "Your workspace"
                      : "Start with a blank canvas"}
                  </h3>
                  <p>
                    {images.length
                      ? `${images.length} image${images.length === 1 ? "" : "s"} • ${processed} processed${images.length > 1 ? ` • ${processed} / ${images.length}` : ""}`
                      : "Your recent projects will appear here."}
                  </p>
                </div>
                {images.length > 0 && (
                  <div className="head-actions">
                    <button
                      className="ghost-button"
                      onClick={() => setConfirmAll(true)}
                    >
                      <Trash2 size={15} /> Delete all
                    </button>
                    {images.length > 1 && (
                      <button
                        className="dark-button"
                        onClick={() => void downloadAll()}
                      >
                        <Archive size={15} /> Download all
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!images.length ? (
                <div className="empty-state">
                  <div className="empty-illustration">
                    <FileImage size={32} />
                    <WandSparkles size={18} />
                  </div>
                  <h3>Your recent images will live here</h3>
                  <p>
                    Upload your first image to see the automatic watermark magic
                    in action.
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() => uploadInput.current?.click()}
                  >
                    <Upload size={16} /> Upload image
                  </button>
                </div>
              ) : (
                <>
                  <div className="image-grid">
                    {images.map((image) => (
                      <div
                        className={`image-tile ${selected?.id === image.id ? "selected" : ""}`}
                        key={image.id}
                      >
                        <button
                          className="image-preview-button"
                          onClick={() => setSelectedId(image.id)}
                        >
                          <img
                            src={image.processed || image.url}
                            alt={image.name}
                          />
                          <span className="tile-check">
                            {image.status === "processing" ? (
                              <span className="spinner" />
                            ) : (
                              <Check size={12} />
                            )}
                          </span>
                        </button>
                        <span className="tile-name">{image.name}</span>
                        <button
                          className="tile-delete"
                          onClick={() => removeImage(image.id)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="preview-panel">
                    <div className="preview-head">
                      <div>
                        <div className="preview-label">
                          <span className="live-dot" /> HIGH QUALITY PREVIEW
                        </div>
                        <h2>{selected?.name}</h2>
                      </div>
                      <div className="preview-tools">
                        <button
                          className="icon-button"
                          onClick={() => setZoom(Math.max(0.7, zoom - 0.1))}
                        >
                          <ZoomOut size={16} />
                        </button>
                        <span>{Math.round(zoom * 100)}%</span>
                        <button
                          className="icon-button"
                          onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                        >
                          <ZoomIn size={16} />
                        </button>
                      </div>
                    </div>
                    {selected && (
                      <>
                        <div className="canvas-stage">
                          <div
                            className="preview-image-wrap"
                            style={{ transform: `scale(${zoom})` }}
                          >
                            <img
                              src={selected.processed || selected.url}
                              alt="Watermarked preview"
                            />
                          </div>
                          <div className="stage-caption">
                            <span>
                              <ShieldCheck size={14} /> Embedded watermark
                            </span>
                            <span>{bytes(selected.file.size)}</span>
                          </div>
                        </div>
                        <div className="image-info">
                          <div>
                            <b>Original Image</b>
                            <span>Width: {selected.naturalWidth} px</span>
                            <span>Height: {selected.naturalHeight} px</span>
                            <span>
                              Aspect Ratio:{" "}
                              {ratio(
                                selected.naturalWidth,
                                selected.naturalHeight,
                              )}
                            </span>
                          </div>
                          <div>
                            <b>Output</b>
                            <span>Width: {outputWidth} px</span>
                            <span>Height: {outputHeight} px</span>
                            <span>Mode: {preset.label}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <aside className="settings-panel">
              <div className="settings-header">
                <div>
                  <p className="eyebrow">BRAND CONTROL</p>
                  <h2>Watermark settings</h2>
                </div>
                <button className="icon-button" onClick={() => setSetup(true)}>
                  <PanelRight size={18} />
                </button>
              </div>
              <div className="settings-scroll">
                <div className="setting-group">
                  <div className="group-label">Brand Watermark</div>
                  <input
                    ref={logoInput}
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void chooseLogo(event)}
                  />
                  <button
                    className="logo-uploader"
                    onClick={() => logoInput.current?.click()}
                  >
                    <div className="mini-logo">
                      <img
                        src={settings.logoData || defaultLogo}
                        alt="Brand logo"
                      />
                    </div>
                    <div>
                      <b>
                        {settings.logoData === defaultLogo
                          ? "water mark png"
                          : "Custom logo uploaded"}
                      </b>
                      <small>Current logo • transparent PNG</small>
                    </div>
                    <Upload size={16} />
                  </button>
                </div>
                <div className="setting-group">
                  <label className="group-label">Company name</label>
                  <input
                    className="text-input"
                    value={settings.companyName}
                    onChange={(event) =>
                      update({ companyName: event.target.value })
                    }
                  />
                </div>
                <div className="setting-group">
                  <div className="group-label">Position</div>
                  <div className="position-grid">
                    {positions.map((position) => (
                      <button
                        key={position}
                        aria-label={position}
                        className={
                          settings.position === position ? "active" : ""
                        }
                        onClick={() => update({ position })}
                      >
                        <span />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-group">
                  <div className="range-label">
                    <span>Watermark size</span>
                    <b>{settings.size}%</b>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="30"
                    value={settings.size}
                    onChange={(event) =>
                      update({ size: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="setting-group">
                  <div className="range-label">
                    <span>Opacity</span>
                    <b>{settings.opacity}%</b>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={settings.opacity}
                    onChange={(event) =>
                      update({ opacity: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="setting-group">
                  <div className="range-label">
                    <span>Rotation</span>
                    <b>{settings.rotation}°</b>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    value={settings.rotation}
                    onChange={(event) =>
                      update({ rotation: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <div className="group-label">Safe margin</div>
                    <small>Spacing from edge</small>
                  </div>
                  <div className="stepper">
                    <button
                      onClick={() =>
                        update({ margin: Math.max(1, settings.margin - 1) })
                      }
                    >
                      −
                    </button>
                    <b>{settings.margin}%</b>
                    <button
                      onClick={() =>
                        update({ margin: Math.min(10, settings.margin + 1) })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="group-label">JPG quality</div>
                    <small>Maximum quality</small>
                  </div>
                  <div className="stepper">
                    <button
                      onClick={() =>
                        update({
                          jpgQuality: Math.max(80, settings.jpgQuality - 1),
                        })
                      }
                    >
                      −
                    </button>
                    <b>{settings.jpgQuality}%</b>
                    <button
                      onClick={() =>
                        update({
                          jpgQuality: Math.min(100, settings.jpgQuality + 1),
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <button
                className="save-button"
                onClick={() => {
                  localStorage.setItem(
                    "absara-watermark-settings",
                    JSON.stringify(settings),
                  );
                  setNotice("Settings saved as default.");
                }}
              >
                <Check size={17} /> Save as default
              </button>
            </aside>
          </div>
          {selected && selected.file.size < 4 * 1024 * 1024 && (
            <div className="quality-warning">
              Your image will be intelligently upscaled for 4K export. Final
              quality depends on the original image resolution.
            </div>
          )}
          <div className="preset-bar">
            <div>
              <div className="eyebrow">EXPORT FORMAT</div>
              <h3>Instagram & high-quality presets</h3>
            </div>
            <div className="preset-options">
              {presets.map((item) => (
                <button
                  key={item.key}
                  className={settings.preset === item.key ? "active" : ""}
                  onClick={() => update({ preset: item.key })}
                >
                  <span>
                    {item.is4k ? (
                      <WandSparkles size={15} />
                    ) : item.key === "original" ? (
                      <SlidersHorizontal size={15} />
                    ) : (
                      <FileImage size={15} />
                    )}
                  </span>
                  <b>{item.label}</b>
                  <small>{item.size}</small>
                </button>
              ))}
            </div>
            <div className="export-actions">
              <button
                className="outline-button"
                disabled={!selected}
                onClick={() => selected && void download(selected, "png")}
              >
                <Download size={16} /> PNG
              </button>
              <button
                className="outline-button"
                disabled={!selected}
                onClick={() => selected && void download(selected, "jpg")}
              >
                <Download size={16} /> JPG
              </button>
              <button
                className="outline-button"
                disabled={!selected}
                onClick={() =>
                  selected &&
                  void download(
                    selected,
                    "png",
                    settings.preset.startsWith("4k")
                      ? settings.preset
                      : "4k-landscape",
                  )
                }
              >
                <WandSparkles size={16} /> 4K PNG
              </button>
              <button
                className="primary-button"
                disabled={!selected}
                onClick={() =>
                  selected &&
                  void download(
                    selected,
                    "jpg",
                    settings.preset.startsWith("4k")
                      ? settings.preset
                      : "4k-landscape",
                  )
                }
              >
                <Download size={16} /> 4K JPG
              </button>
            </div>
          </div>
        </section>
      </main>
      {confirmAll && (
        <div className="modal-backdrop">
          <div className="confirm-modal">
            <h2>Remove all uploaded images?</h2>
            <p>
              This removes workspace previews only. Your original files stay on
              your computer.
            </p>
            <div>
              <button
                className="outline-button"
                onClick={() => setConfirmAll(false)}
              >
                Cancel
              </button>
              <button
                className="dark-button"
                onClick={() => {
                  setImages([]);
                  setSelectedId(null);
                  setConfirmAll(false);
                }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
      {setup && (
        <div className="modal-backdrop">
          <div className="setup-modal">
            <button className="modal-close" onClick={() => setSetup(false)}>
              <X size={18} />
            </button>
            <div className="setup-art">
              <div className="setup-logo">AB</div>
              <span>
                YOUR BRAND
                <br />
                YOUR SIGNATURE
              </span>
            </div>
            <p className="eyebrow">WELCOME TO AUTO WATERMARK STUDIO</p>
            <h2>Set your brand watermark</h2>
            <p className="modal-copy">
              Your bundled “water mark png” is ready. Every image you upload
              will be branded automatically.
            </p>
            <button
              className="save-button"
              onClick={() => {
                localStorage.setItem(
                  "absara-watermark-settings",
                  JSON.stringify(settings),
                );
                setSetup(false);
              }}
            >
              <WandSparkles size={17} /> Save brand & start creating
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
