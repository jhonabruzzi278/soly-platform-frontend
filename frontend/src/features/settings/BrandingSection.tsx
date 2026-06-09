import { useState } from "react";
import { useWorkspace } from "../../app/WorkspaceProvider";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { WorkspaceSettings } from "../../lib/types";

const DEFAULT_SETTINGS: WorkspaceSettings = {
  business_name: "Soly",
  business_subtitle: "Gestion inteligente, simplificada",
  business_logo_url: null,
  login_image_url: null,
  support_email: null
};

type Props = {
  onFeedback: (fb: { tone: "default" | "danger"; title: string; description: string } | null) => void;
};

export const BrandingSection = ({ onFeedback }: Props) => {
  const { settings, updateSettings } = useWorkspace();
  const [draft, setDraft] = useState<WorkspaceSettings>(settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    onFeedback(null);
    try {
      await updateSettings({
        business_name: draft.business_name.trim() || DEFAULT_SETTINGS.business_name,
        business_subtitle: draft.business_subtitle?.trim() || null
      });
      onFeedback({ tone: "default", title: "Cambios guardados", description: "La configuracion del negocio quedo actualizada." });
    } catch (error) {
      onFeedback({ tone: "danger", title: "No se pudo completar", description: error instanceof Error ? error.message : "Error desconocido." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle>Marca</CardTitle>
            <CardDescription>Define nombre comercial y subtitulo.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              <MaterialIcon name="save" size={18} filled />
              {saving ? "Guardando..." : "Guardar configuracion"}
            </Button>
            <Button variant="outline" onClick={() => setDraft(DEFAULT_SETTINGS)} disabled={saving}>
              Restaurar base
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput
            label="Nombre del negocio"
            value={draft.business_name}
            onChange={(value) => setDraft((prev) => ({ ...prev, business_name: value }))}
            placeholder="Soly"
          />
          <FormInput
            label="Subtitulo"
            value={draft.business_subtitle ?? ""}
            onChange={(value) => setDraft((prev) => ({ ...prev, business_subtitle: value }))}
            placeholder="Gestion inteligente"
          />
        </div>
      </CardContent>
    </Card>
  );
};
