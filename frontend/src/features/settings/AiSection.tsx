import { useEffect, useState } from "react";
import { useTenant } from "../../hooks/useTenant";
import { fetchAiSettings, saveAiSettings, deleteAiSettings } from "../../lib/api";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

type Props = {
  onFeedback: (fb: { tone: "default" | "danger"; title: string; description: string } | null) => void;
};

const PROVIDER_HINTS: Record<string, { baseUrl: string; model: string }> = {
  anthropic: { baseUrl: "https://api.anthropic.com (por defecto)", model: "claude-haiku-4-5-20251001" },
  openai: { baseUrl: "https://api.openai.com/v1 (o OpenRouter, Groq, etc.)", model: "gpt-4o-mini" }
};

export const AiSection = ({ onFeedback }: Props) => {
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);

  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    fetchAiSettings(tenant.id)
      .then((settings) => {
        if (cancelled) return;
        if (settings) {
          setConfigured(true);
          setProvider(settings.provider);
          setBaseUrl(settings.base_url ?? "");
          setModel(settings.model);
        }
      })
      .catch(() => { /* sin configuración previa */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant?.id]);

  const save = async () => {
    if (!tenant?.id) return;
    if (!model.trim()) {
      onFeedback({ tone: "danger", title: "Error", description: "Indica el modelo a usar (ej: claude-haiku-4-5-20251001)." });
      return;
    }
    if (!configured && !apiKey.trim()) {
      onFeedback({ tone: "danger", title: "Error", description: "Ingresa la API key del proveedor." });
      return;
    }
    if (baseUrl.trim() && !baseUrl.trim().startsWith("https://")) {
      onFeedback({ tone: "danger", title: "Error", description: "La URL base debe comenzar con https://" });
      return;
    }

    setSaving(true);
    onFeedback(null);
    try {
      await saveAiSettings(tenant.id, {
        provider,
        base_url: baseUrl.trim() || null,
        model: model.trim(),
        api_key: apiKey.trim() || undefined
      });
      setConfigured(true);
      setApiKey("");
      onFeedback({
        tone: "default",
        title: "Asistente de IA configurado",
        description: "La importación de planillas usará este modelo para reconocer columnas difíciles."
      });
    } catch (error) {
      onFeedback({ tone: "danger", title: "No se pudo guardar", description: error instanceof Error ? error.message : "Error desconocido." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!tenant?.id) return;
    if (!window.confirm("¿Eliminar la configuración de IA? La importación seguirá funcionando con la detección automática.")) return;
    setSaving(true);
    try {
      await deleteAiSettings(tenant.id);
      setConfigured(false);
      setProvider("anthropic");
      setBaseUrl("");
      setModel("");
      setApiKey("");
      onFeedback({ tone: "default", title: "Configuración eliminada", description: "El asistente de IA quedó desactivado." });
    } catch (error) {
      onFeedback({ tone: "danger", title: "No se pudo eliminar", description: error instanceof Error ? error.message : "Error desconocido." });
    } finally {
      setSaving(false);
    }
  };

  const hints = PROVIDER_HINTS[provider];

  return (
    <Card className="rounded-xl">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="smart_toy" size={20} />
              Asistente de IA para importación
              {configured ? (
                <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--success)]">Activo</span>
              ) : null}
            </CardTitle>
            <CardDescription>
              Opcional: conecta cualquier proveedor de IA para reconocer columnas con nombres poco comunes al importar planillas.
              La key se guarda de forma segura y no se puede volver a leer desde la app.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {configured ? (
              <Button variant="outline" onClick={() => void remove()} disabled={saving}>
                <MaterialIcon name="delete" size={16} />
                Eliminar
              </Button>
            ) : null}
            <Button onClick={() => void save()} disabled={saving || loading}>
              <MaterialIcon name="save" size={16} />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Cargando configuración...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Proveedor</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as "anthropic" | "openai")}
                className="theme-input rounded-lg px-3 py-2 text-sm"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI / compatible (OpenRouter, Groq, Gemini...)</option>
              </select>
            </div>
            <FormInput
              label="Modelo"
              value={model}
              onChange={setModel}
              placeholder={hints.model}
            />
            <FormInput
              label="URL base (opcional)"
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder={hints.baseUrl}
            />
            <FormInput
              label={configured ? "API key (dejar vacío para mantener la actual)" : "API key"}
              type="password"
              value={apiKey}
              onChange={setApiKey}
              placeholder={configured ? "••••••••  (guardada)" : "sk-..."}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
