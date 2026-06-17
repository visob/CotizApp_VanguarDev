import { createPortal } from "react-dom";
import { Button } from "../../components/common/Button";

export type CompanyDraft = {
  nombre: string;
  cuit: string;
  razon_social: string;
  direccion: string;
  provincia: string;
  codigo_postal: string;
  pais: string;
  telefono_contacto: string;
  email: string;
  website_url: string;
  footer_text: string;
  logoFile: File | null;
  logoPreviewUrl: string | null;
  removeLogo: boolean;
};

export function createEmptyCompanyDraft(): CompanyDraft {
  return {
    nombre: "",
    cuit: "",
    razon_social: "",
    direccion: "",
    provincia: "",
    codigo_postal: "",
    pais: "Argentina",
    telefono_contacto: "",
    email: "",
    website_url: "",
    footer_text: "",
    logoFile: null,
    logoPreviewUrl: null,
    removeLogo: false
  };
}

export function CompanyFormDialog(props: {
  open: boolean;
  title: string;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  draft: CompanyDraft;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  onChange: <K extends keyof CompanyDraft>(field: K, value: CompanyDraft[K]) => void;
  onLogoChange: (file: File | null) => void;
}) {
  if (!props.open) return null;

  return createPortal(
    <div className="modalOverlay" onClick={() => (props.saving ? null : props.onClose())}>
      <div className="modalContent companyDialog" onClick={(event) => event.stopPropagation()}>
        <h3>{props.title}</h3>
        <div className="hint" style={{ marginTop: 4, marginBottom: 18 }}>
          Los campos `URL de pagina web` y `Pie de pagina` son opcionales.
        </div>

        {props.error ? <div className="error" style={{ marginBottom: 16 }}>{props.error}</div> : null}

        <div className="companyFormGrid">
          <label className="field companyFormGrid__full">
            <span className="label">Logo</span>
            <div className="companyLogoField">
              <div className="companyLogoPreview">
                {props.draft.logoPreviewUrl && !props.draft.removeLogo ? (
                  <img src={props.draft.logoPreviewUrl} alt="Logo de la empresa" />
                ) : (
                  <span>Sin logo</span>
                )}
              </div>
              <div className="companyLogoActions">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.ico,image/jpeg,image/png,image/x-icon,image/vnd.microsoft.icon"
                  onChange={(event) => props.onLogoChange(event.target.files?.[0] ?? null)}
                  disabled={props.saving}
                />
                <div className="hint">Formatos permitidos: JPG, PNG, ICO. Maximo 5MB.</div>
                {props.draft.logoPreviewUrl ? (
                  <Button
                    type="button"
                    className="btn--ghost btn--sm"
                    onClick={() => {
                      props.onLogoChange(null);
                      props.onChange("removeLogo", true);
                    }}
                    disabled={props.saving}
                  >
                    Quitar logo
                  </Button>
                ) : null}
              </div>
            </div>
          </label>

          <label className="field">
            <span className="label">Nombre</span>
            <input className="input" value={props.draft.nombre} onChange={(e) => props.onChange("nombre", e.target.value)} />
          </label>

          <label className="field">
            <span className="label">CUIT</span>
            <input className="input" value={props.draft.cuit} onChange={(e) => props.onChange("cuit", e.target.value)} />
          </label>

          <label className="field companyFormGrid__full">
            <span className="label">Razon Social</span>
            <input className="input" value={props.draft.razon_social} onChange={(e) => props.onChange("razon_social", e.target.value)} />
          </label>

          <label className="field companyFormGrid__full">
            <span className="label">Direccion</span>
            <input className="input" value={props.draft.direccion} onChange={(e) => props.onChange("direccion", e.target.value)} />
          </label>

          <label className="field">
            <span className="label">Provincia</span>
            <input className="input" value={props.draft.provincia} onChange={(e) => props.onChange("provincia", e.target.value)} />
          </label>

          <label className="field">
            <span className="label">Codigo Postal</span>
            <input className="input" value={props.draft.codigo_postal} onChange={(e) => props.onChange("codigo_postal", e.target.value)} />
          </label>

          <label className="field">
            <span className="label">Pais</span>
            <input className="input" value={props.draft.pais} onChange={(e) => props.onChange("pais", e.target.value)} />
          </label>

          <label className="field">
            <span className="label">Telf. Contacto</span>
            <input className="input" value={props.draft.telefono_contacto} onChange={(e) => props.onChange("telefono_contacto", e.target.value)} />
          </label>

          <label className="field">
            <span className="label">Email</span>
            <input className="input" type="email" value={props.draft.email} onChange={(e) => props.onChange("email", e.target.value)} />
          </label>

          <label className="field">
            <span className="label">URL de Pagina web</span>
            <input className="input" type="url" value={props.draft.website_url} onChange={(e) => props.onChange("website_url", e.target.value)} />
          </label>

          <label className="field companyFormGrid__full">
            <span className="label">Pie de pagina</span>
            <textarea className="textarea" value={props.draft.footer_text} onChange={(e) => props.onChange("footer_text", e.target.value)} />
          </label>
        </div>

        <div className="modalActions">
          <Button onClick={props.onClose} className="btn--ghost" disabled={props.saving}>
            Cancelar
          </Button>
          <Button onClick={props.onSubmit} className="btn--primary" disabled={props.saving}>
            {props.saving ? "Guardando..." : props.submitLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
