
const consentForm = document.querySelector('#consent_form');
const button = document.querySelector('button[type="submit"]');
button.addEventListener('click', (ev) => {
  ev.preventDefault();
  button.disabled = true;
  consentForm.submit();
});
