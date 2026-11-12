// Form building blocks shared by the Crop Finder and the farm profile.

export const fieldClass =
  "w-full rounded-[14px] border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3 text-[14px] text-[#1f2d27] outline-none focus:border-[#4b805d] focus:ring-2 focus:ring-[#4b805d]/20";

export function ChoiceCard({
  name,
  value,
  label,
  description,
  type,
  required = false,
  variant = "card",
  checked,
  defaultChecked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  description?: string;
  type: "checkbox" | "radio";
  required?: boolean;
  variant?: "chip" | "card";
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: () => void;
}) {
  const className = description
    ? "flex min-h-[112px] cursor-pointer flex-col rounded-[18px] border border-[#dfe8df] bg-white p-3 text-left transition has-[:checked]:border-[#1d4d31] has-[:checked]:bg-[#ebf4ec] has-[:checked]:shadow-[inset_0_0_0_1px_rgba(24,92,57,0.12)]"
    : variant === "chip"
      ? "flex cursor-pointer items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-[12px] font-medium text-[#4a594f] transition has-[:checked]:border-[#1d4d31] has-[:checked]:bg-[#e9f2eb] has-[:checked]:text-[#1e4d35]"
      : type === "radio"
        ? "flex cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[#dfe8df] bg-white px-3 py-2.5 text-[12px] font-semibold text-[#4d5d53] has-[:checked]:border-[#1d4d31] has-[:checked]:bg-[#eaf2eb] has-[:checked]:text-[#1d4d31]"
        : "flex cursor-pointer items-center gap-2 rounded-[16px] border border-[#dfe8df] bg-white px-3 py-2.5 text-left text-[12px] font-medium text-[#4c5d52] has-[:checked]:border-[#739a7e] has-[:checked]:bg-[#eaf2eb] has-[:checked]:text-[#1e4d35]";
  const controlledProps =
    checked === undefined ? { defaultChecked } : { checked, onChange };
  const input = (
    <input
      type={type}
      name={name}
      value={value}
      required={required}
      className="size-4 shrink-0 accent-[#1d4d31]"
      {...controlledProps}
    />
  );

  return (
    <label className={className}>
      {description ? (
        <>
          <span className="flex items-center gap-2">
            {input}
            <span className="text-[13px] font-semibold text-[#1f2e29]">
              {label}
            </span>
          </span>
          <p className="mt-2 text-[12px] leading-5 text-[#5b6d62]">
            {description}
          </p>
        </>
      ) : (
        <>
          {input}
          <span>{label}</span>
        </>
      )}
    </label>
  );
}

export function SectionShell({
  step,
  title,
  required = false,
  rightLabel,
  children,
}: {
  step: number;
  title: string;
  required?: boolean;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#dfe8df] bg-[#f8faf6] shadow-[0_1px_0_rgba(14,36,22,0.02)]">
      <div className="flex items-center justify-between gap-4 border-b border-[#e3e9e0] bg-[#f4f8f1] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e7f1e7] text-[12px] font-bold text-[#1d4d31]">
            {step}
          </span>
          <h3 className="text-[12px] font-bold tracking-[0.12em] text-[#1f3624] uppercase">
            {title}
          </h3>
        </div>
        {required ? (
          <span className="text-[12px] font-semibold tracking-[0.14em] text-[#1d4d31] uppercase">
            Required
          </span>
        ) : (
          <span className="text-[12px] text-[#7c857e]">
            {rightLabel ?? "Optional"}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
