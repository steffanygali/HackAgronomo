import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Server,
  Upload,
  X,
} from 'lucide-react';
import { checkBackendHealth, getBackendUrl, setBackendUrl } from '../services/api';
import { Button, IconButton, Tag, cn } from './ui';

export interface BackendConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataSource: 'backend' | 'local-dataset';
  onReconnect: () => Promise<void>;
  onUploadCustomJson: (jsonText: string) => void;
}

export const BackendConnectModal: React.FC<BackendConnectModalProps> = ({
  isOpen,
  onClose,
  dataSource,
  onReconnect,
  onUploadCustomJson,
}) => {
  const [urlInput, setUrlInput] = useState(getBackendUrl() || 'http://localhost:8000');
  const [isTesting, setIsTesting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [connectAttempted, setConnectAttempted] = useState(false);
  const [connectMessage, setConnectMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync url input with stored url when modal opens
  useEffect(() => {
    if (isOpen) {
      setUrlInput(getBackendUrl() || 'http://localhost:8000');
      setConnectMessage(null);
      setConnectAttempted(false);
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle connect attempt result check
  useEffect(() => {
    if (!connectAttempted) return;
    const currentUrl = getBackendUrl();
    if (currentUrl && dataSource === 'backend') {
      setConnectMessage({
        type: 'success',
        text: 'Conectado exitosamente con la API del backend.',
      });
    } else {
      setConnectMessage({
        type: 'error',
        text: 'No se pudo conectar, se usan datos de ejemplo',
      });
    }
    setConnectAttempted(false);
  }, [dataSource, connectAttempted]);

  if (!isOpen) return null;

  const handleSaveAndConnect = async () => {
    setIsTesting(true);
    setConnectMessage(null);
    setBackendUrl(urlInput);
    try {
      const healthy = await checkBackendHealth();
      await onReconnect();
      if (healthy) {
        setConnectMessage({
          type: 'success',
          text: 'Conectado exitosamente con la API del backend (/health y /api/v1/* activos).',
        });
      } else {
        setConnectAttempted(true);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleUseLocalMock = async () => {
    setIsTesting(true);
    setConnectMessage(null);
    setBackendUrl('');
    setUrlInput('');
    try {
      await onReconnect();
      setConnectMessage({
        type: 'success',
        text: 'Cambiado a datos de ejemplo integrados.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        onUploadCustomJson(content);
        setUploadStatus(`Archivo "${file.name}" cargado correctamente.`);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="backend-modal-title"
        className="bg-m3-surface-container-high rounded-m3-xl shadow-m3-3 max-w-[560px] w-[calc(100%-32px)] max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4 border-b border-m3-outline-variant/30">
          <div className="flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-m3-secondary-container text-m3-on-secondary-container flex items-center justify-center mb-3">
              <Server className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 id="backend-modal-title" className="text-headline-s text-m3-on-surface font-normal">
              Conexión de datos
            </h2>
            <p className="text-body-m text-m3-on-surface-variant mt-1">
              Conecta tu API o importa un archivo con tus predicciones.
            </p>
          </div>
          <IconButton
            variant="standard"
            icon={<X />}
            aria-label="Cerrar"
            onClick={onClose}
          />
        </div>

        {/* Body (scrollable) */}
        <div className="px-6 py-5 flex-1 overflow-y-auto space-y-6">
          {/* Status row */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-m3-md bg-m3-surface-container border border-m3-outline-variant">
            <div className="flex items-center gap-2">
              {dataSource === 'backend' ? (
                <Tag tone="primary" icon={<CheckCircle2 />}>
                  Conectado a la API
                </Tag>
              ) : (
                <Tag tone="neutral">Datos de ejemplo integrados</Tag>
              )}
            </div>
            <span className="text-body-s text-m3-on-surface-variant tabular-nums truncate max-w-[240px]">
              {getBackendUrl() || 'Sin URL configurada'}
            </span>
          </div>

          {/* Section: URL del backend */}
          <div className="space-y-2">
            <label
              htmlFor="backend-url-field"
              className="block text-body-s font-medium text-m3-on-surface-variant"
            >
              URL del backend
            </label>
            <input
              id="backend-url-field"
              ref={inputRef}
              autoFocus
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:8000"
              className="h-12 w-full rounded-m3-xs border border-m3-outline bg-transparent px-3 text-body-m font-sans text-m3-on-surface outline-none transition-colors focus:border-2 focus:border-m3-primary"
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="filled"
                onClick={handleSaveAndConnect}
                disabled={isTesting}
                icon={<RefreshCw className={isTesting ? 'animate-spin' : ''} />}
              >
                {isTesting ? 'Conectando…' : 'Conectar'}
              </Button>
              <Button
                variant="text"
                onClick={handleUseLocalMock}
                disabled={isTesting}
              >
                Usar datos de ejemplo
              </Button>
            </div>

            {connectMessage && (
              <div
                className={cn(
                  'text-body-s font-medium pt-1',
                  connectMessage.type === 'success' ? 'text-m3-primary' : 'text-m3-error'
                )}
              >
                {connectMessage.text}
              </div>
            )}
          </div>

          {/* Section: Importar archivo */}
          <div className="space-y-2 pt-2 border-t border-m3-outline-variant/30">
            <label className="block text-body-s font-medium text-m3-on-surface-variant">
              Importar archivo
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                'border-2 border-dashed border-m3-outline-variant rounded-m3-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-transparent select-none state-layer focus-visible:border-m3-primary',
                isDragging
                  ? 'border-m3-primary bg-m3-primary-container/10'
                  : 'hover:border-m3-primary'
              )}
            >
              <Upload className="w-6 h-6 text-m3-primary mb-2" aria-hidden="true" />
              <div className="text-title-s font-medium text-m3-on-surface">
                Selecciona un archivo .json
              </div>
              <div className="text-body-s text-m3-on-surface-variant mt-0.5">
                Arreglo de parcelas con el mismo formato que GET /api/parcels
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {uploadStatus && (
              <div className="text-body-s font-medium text-m3-primary pt-1">
                {uploadStatus}
              </div>
            )}
          </div>

          {/* Section: Endpoints esperados */}
          <details className="group border border-m3-outline-variant/60 rounded-m3-md overflow-hidden">
            <summary className="p-3 text-title-s font-medium text-m3-on-surface bg-m3-surface-container cursor-pointer select-none flex items-center justify-between list-none state-layer">
              <span>Endpoints integrados (/api/* y /api/v1/*)</span>
              <span className="text-body-s text-m3-on-surface-variant transition-transform duration-200 group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="p-3 bg-m3-surface-container-low border-t border-m3-outline-variant/30">
              <pre className="bg-m3-inverse-surface text-m3-inverse-on-surface rounded-m3-md p-4 font-mono text-body-s overflow-x-auto leading-relaxed">
{`GET  /api/parcels
  -> 197 parcelas georreferenciadas (70% train, 30% eval), sub-lotes A/B/C y 6 fechas Sentinel-2.

GET  /api/model-insights
  -> Métricas de validación cruzada y las 3 Preguntas Guía FIRA.

POST /api/predict
  -> Inferencia interactiva con NDVI, NDWI, EVI, lluvia, temperatura y GDD.

GET  /api/v1/meta | /api/v1/modelos | /api/v1/municipios
  -> Metadatos del modelo ganador, comparativa de 9 modelos y métricas por municipio.

GET  /api/v1/parcelas | /api/v1/parcelas/{id} | /api/v1/export/anexo.csv
  -> 59 parcelas del Anexo FIRA con desglose (mediana municipal + ajuste Ridge) y exportación CSV.`}
              </pre>
            </div>
          </details>
        </div>

        {/* Footer actions */}
        <div className="p-6 pt-4 flex justify-end border-t border-m3-outline-variant/30">
          <Button variant="text" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};

