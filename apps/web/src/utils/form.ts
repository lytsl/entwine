export function focusInvalidFormField(formId: string) {
	const form = document.getElementById(formId);
	if (!form) {
		console.error(
			`focusInvalidFormField: could not find form with id "${formId}"`,
		);
		return;
	}

	const firstInvalid = form.querySelector('[aria-invalid="true"]');
	if (!firstInvalid) return;

	firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
	if (firstInvalid instanceof HTMLElement) {
		firstInvalid.focus({ preventScroll: true });
	}
}
