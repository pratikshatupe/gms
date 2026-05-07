import React, { useMemo, useState } from 'react';
import { BadgeCheck, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { Field, SearchableSelect } from '../../components/ui';
import {
  idTypesForCountry, validateIdNumber, normaliseIdPayload,
  formatAadhaar, formatEmiratesId, blobToDataUrl,
} from '../../utils/walkInHelpers';

/**
 * IdProofStep — Step 3 of the Walk-In wizard.
 *
 * Country-aware ID type picker. Validation runs on blur AND on Next
 * click. Optional ID-image upload (data URL). Skip link always
 * visible — ID capture is optional for instant check-in.
 */

export default function IdProofStep({ form, setField, orgCountry }) {
  const idTypes = useMemo(() => idTypesForCountry(orgCountry), [orgCountry]);
  const [touched, setTouched] = useState(false);
  const [uploading, setUpload] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const idType = form.visitor?.idType || idTypes[0];
  const idNumber = form.visitor?.idNumber || '';
  const idDisplay = form.visitor?.idNumberDisplay || '';

  /* Validate on blur / on Next. Errors re-run on type change too. */
  const runValidate = (type, value) => validateIdNumber(type, value, orgCountry);
  const currentError = touched ? runValidate(idType, idNumber) : null;

  const onTypeChange = (v) => {
    setField('visitor.idType', v);
    /* Clear number when type changes — formats differ. */
    setField('visitor.idNumber', '');
    setField('visitor.idNumberDisplay', '');
    setTouched(false);
  };

  const onNumberChange = (raw) => {
    const { idNumber: norm, idNumberDisplay: disp } = normaliseIdPayload(idType, raw);
    setField('visitor.idNumber', norm);
    setField('visitor.idNumberDisplay', disp || raw);
  };

  const onBlur = () => {
    setTouched(true);
    /* Reformat display on blur to insert spaces / dashes where applicable. */
    if (idType === 'Aadhaar') {
      setField('visitor.idNumberDisplay', formatAadhaar(idNumber));
    } else if (idType === 'Emirates ID') {
      setField('visitor.idNumberDisplay', formatEmiratesId(idNumber));
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpload(true);
    setUploadError('');
    try {
      if (file.size > 3 * 1024 * 1024) {
        setUploadError('ID image file is too large. Please choose an image under 3 MB.');
        setUpload(false);
        return;
      }
      const dataUrl = await blobToDataUrl(file);
      setField('visitor.idImageDataUrl', dataUrl);
    } catch {
      setUploadError('Could not read the selected image. Please try again.');
    } finally {
      setUpload(false);
    }
  };

  const skip = () => {
    setField('visitor.idType', '');
    setField('visitor.idNumber', '');
    setField('visitor.idNumberDisplay', '');
    setField('visitor.idImageDataUrl', '');
    setTouched(false);
  };

  const isOther = idType === 'Other';

  /* Placeholder copy per type. */
  const placeholder = idType === 'Aadhaar'     ? 'Enter 12-digit Aadhaar Number'
                    : idType === 'PAN'         ? 'Enter PAN Number (e.g. AAAAA0000A)'
                    : idType === 'Passport'    ? 'Enter Passport Number'
                    : idType === 'Driving Licence' ? 'Enter Driving Licence Number'
                    : idType === 'Emirates ID' ? 'Enter 15-digit Emirates ID'
                    : 'Enter ID Number';

  return (
    <div>
      <p className="mb-4 text-[13px] text-slate-600 dark:text-slate-300">
        Capture a government-issued ID for the visitor, or skip if not required by your organisation&rsquo;s policy.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="ID Type" required>
          <SearchableSelect
            value={idType}
            onChange={onTypeChange}
            options={idTypes.map((t) => ({
              value: t,
              label: t === 'Aadhaar' ? 'Aadhar - Number'
                  : t === 'PAN'      ? 'PAN Card - Number'
                  : t,
            }))}
            placeholder="Select ID Type"
          />
        </Field>
        <Field label="ID Number" required error={currentError} hint={isOther ? undefined : undefined}>
          <input
            type="text" value={idDisplay || idNumber}
            onChange={(e) => onNumberChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            maxLength={30}
            className={`w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:bg-[#071220] dark:text-slate-200 ${currentError ? 'border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/40' : 'border-slate-200 dark:border-[#142535]'}`}
          />
        </Field>
      </div>

      {isOther && (
        <div className="mt-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-[11px] text-amber-800 dark:text-amber-200">
              Please verify this ID type is acceptable for your organisation&rsquo;s compliance requirements.
            </p>
          </div>
        </div>
      )}

      {/* Optional ID image upload */}
      <div className="mt-4">
        <label htmlFor="walkin-id-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
          {uploading
            ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            : form.visitor?.idImageDataUrl ? <BadgeCheck size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
          {uploading ? 'Uploading…' : (form.visitor?.idImageDataUrl ? 'ID image attached' : 'Upload ID Image (optional)')}
        </label>
        <input
          id="walkin-id-upload" type="file" accept="image/*"
          disabled={uploading} className="sr-only"
          onChange={onUpload}
        />
        {uploadError && (
          <p role="alert" className="mt-1 text-[11px] font-semibold text-red-500">{uploadError}</p>
        )}
      </div>

      {form.visitor?.idImageDataUrl && (
        <img
          src={form.visitor.idImageDataUrl}
          alt="ID preview"
          className="mt-3 h-[140px] w-auto rounded-[10px] border border-slate-200 dark:border-[#142535]"
        />
      )}

      <div className="mt-5 text-center">
        <button type="button" onClick={skip}
          className="cursor-pointer text-[12px] font-semibold text-slate-500 underline-offset-2 hover:text-sky-700 hover:underline dark:text-slate-400 dark:hover:text-sky-300">
          Skip ID capture
        </button>
      </div>
    </div>
  );
}

/**
 * validateStep3 — run-time gate on Next. Returns null when Step 3 is
 * "complete" (either filled-and-valid, or fully skipped). The wizard
 * treats this step as optional overall; this validator only fails
 * when the operator has started entering an ID but left it invalid.
 */
export function validateStep3(form, orgCountry) {
  const type   = form.visitor?.idType;
  const number = form.visitor?.idNumber;
  if (!type && !number) return null;    /* fully skipped */
  if (type && !number)  return { 'visitor.idNumber': 'ID Number is required.' };
  if (!type)            return { 'visitor.idType':   'ID Type is required.' };
  const err = validateIdNumber(type, number, orgCountry);
  if (err) return { 'visitor.idNumber': err };
  return null;
}
