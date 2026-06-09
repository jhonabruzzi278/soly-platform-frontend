import { useState } from "react";
import { changeCurrentUserPassword } from "../../lib/api";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

type Props = {
  onFeedback: (fb: { tone: "default" | "danger"; title: string; description: string } | null) => void;
};

export const PasswordSection = ({ onFeedback }: Props) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const update = async () => {
    if (password.trim().length < 8) {
      onFeedback({ tone: "danger", title: "Error", description: "La contrasena debe tener al menos 8 caracteres." });
      return;
    }
    if (password !== confirm) {
      onFeedback({ tone: "danger", title: "Error", description: "Las contrasenas no coinciden." });
      return;
    }

    setSaving(true);
    onFeedback(null);
    try {
      await changeCurrentUserPassword(password);
      setPassword("");
      setConfirm("");
      onFeedback({ tone: "default", title: "Contrasena actualizada", description: "Contrasena actualizada correctamente." });
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
            <CardTitle>Seguridad de cuenta</CardTitle>
            <CardDescription>Cambia la contrasena de tu cuenta desde la sesion activa.</CardDescription>
          </div>
          <Button onClick={() => void update()} disabled={saving}>
            <MaterialIcon name="lock_reset" size={18} />
            {saving ? "Actualizando..." : "Actualizar contrasena"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Nueva contrasena" type="password" value={password} onChange={setPassword} placeholder="Minimo 8 caracteres" />
          <FormInput label="Confirmar contrasena" type="password" value={confirm} onChange={setConfirm} placeholder="Repite la contrasena" />
        </div>
      </CardContent>
    </Card>
  );
};
