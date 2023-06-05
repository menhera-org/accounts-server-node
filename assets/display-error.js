
const params = new URLSearchParams(window.location.search);
if (params.get('error')) {
  document.getElementById('error').textContent = params.get('error');
}
const message = params.get('message');
if (message) {
  document.getElementById('error').textContent += `: ${message}`;
}
