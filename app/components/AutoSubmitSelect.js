'use client';

// Падащо меню, което изпраща формата веднага при промяна (без бутон „Покажи“).
export default function AutoSubmitSelect({ children, ...props }) {
  return (
    <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  );
}
