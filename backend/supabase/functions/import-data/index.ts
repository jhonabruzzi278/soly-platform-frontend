import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey);

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes(";") ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").replace(/^"|"$/g, "").trim();
    });
    if (Object.values(row).some((v) => v)) {
      rows.push(row);
    }
  }

  return { headers, rows };
}

function autoMap(headers: string[], table: string): Record<string, string> {
  const mapping: Record<string, string> = {};
  const commonMappings: Record<string, Record<string, string[]>> = {
    customers: {
      name: ["nombre", "name", "cliente", "customer"],
      email: ["email", "correo", "mail"],
      phone: ["telefono", "phone", "fono", "celular", "tel"],
      company: ["empresa", "company", "compañia", "compania"],
      notes: ["notas", "notes", "comentarios", "observaciones"],
      tags: ["tags", "etiquetas", "categoria"]
    },
    appointments: {
      customer_name: ["cliente", "customer", "nombre", "name"],
      appointment_date: ["fecha", "date", "dia"],
      appointment_time: ["hora", "time", "horario"],
      service_name: ["servicio", "service", "tratamiento"],
      cost: ["costo", "cost", "precio", "price", "monto", "valor"],
      status: ["estado", "status"],
      comments: ["comentarios", "comments", "notas", "notes"]
    },
    services: {
      name: ["nombre", "name", "servicio", "service"],
      price: ["precio", "price", "costo", "cost", "valor"]
    },
    inventory: {
      name: ["nombre", "name", "producto", "product"],
      supplier: ["proveedor", "supplier", "proveedor"],
      cost: ["costo", "cost", "precio_compra"],
      sale_price: ["precio_venta", "sale_price", "precio", "price"],
      stock: ["stock", "cantidad", "quantity", "inventario"],
      min_stock: ["stock_minimo", "min_stock", "minimo"]
    }
  };

  const tableMap = commonMappings[table] ?? {};
  for (const header of headers) {
    const clean = header.toLowerCase().trim();
    for (const [dbCol, aliases] of Object.entries(tableMap)) {
      if (aliases.includes(clean)) {
        mapping[clean] = dbCol;
        break;
      }
    }
    if (!mapping[clean]) {
      mapping[clean] = clean;
    }
  }

  return mapping;
}

const tableColumns: Record<string, string[]> = {
  customers: ["name", "email", "phone", "company", "notes", "tags"],
  appointments: ["customer_id", "appointment_date", "appointment_time", "service_name", "cost", "status", "comments"],
  services: ["name", "price"],
  inventory: ["name", "supplier", "cost", "sale_price", "stock", "min_stock"]
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenant_id, file_path, table, column_mapping } = await req.json();

    if (!tenant_id || !file_path || !table) {
      return new Response(JSON.stringify({ error: "Faltan tenant_id, file_path o table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const validTables = ["customers", "appointments", "services", "inventory"];
    if (!validTables.includes(table)) {
      return new Response(JSON.stringify({ error: `Tabla no valida: ${table}. Validas: ${validTables.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("excel-files")
      .download(`${tenant_id}/${file_path}`);

    if (downloadError) throw downloadError;

    const text = await fileData.text();
    const { headers, rows } = parseCsv(text);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "El archivo esta vacio o no tiene datos validos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const mapping = column_mapping ?? autoMap(headers, table);
    const cols = tableColumns[table] ?? [];

    const payloads: Record<string, unknown>[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const payload: Record<string, unknown> = { tenant_id };

      for (const col of cols) {
        const csvKey = Object.keys(mapping).find((k) => mapping[k] === col);
        const value = csvKey ? row[csvKey] : row[col] ?? "";
        if (value !== undefined && value !== "") {
          if (col === "cost" || col === "sale_price" || col === "price" || col === "stock" || col === "min_stock") {
            const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
            payload[col] = isNaN(num) ? 0 : num;
          } else if (col === "tags") {
            payload[col] = value.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
          } else {
            payload[col] = value;
          }
        }
      }

      if (table === "customers" && !payload.name) {
        errors.push(`Fila ${i + 2}: falta nombre`);
        continue;
      }
      if (table === "appointments" && (!payload.appointment_date || !payload.service_name)) {
        errors.push(`Fila ${i + 2}: falta fecha o servicio`);
        continue;
      }
      if (table === "services" && !payload.name) {
        errors.push(`Fila ${i + 2}: falta nombre del servicio`);
        continue;
      }
      if (table === "inventory" && !payload.name) {
        errors.push(`Fila ${i + 2}: falta nombre del producto`);
        continue;
      }

      payloads.push(payload);
    }

    if (payloads.length === 0) {
      return new Response(JSON.stringify({ imported: 0, errors, message: "No hay filas validas para importar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { error: insertError } = await adminClient
      .from(table)
      .insert(payloads);

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      imported: payloads.length,
      total: rows.length,
      errors,
      headers,
      mapping
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
