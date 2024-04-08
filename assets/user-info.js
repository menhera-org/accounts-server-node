
fetch('/get-username')
.then(response => response.json())
.then(data => {
  if (!data.logged_in) return;
  document.getElementById('username').textContent = data.username;
  if (data.is_admin) {
    document.body.classList.add('admin');
    document.getElementById('username').textContent += ' (admin)';
  }
  if (data.is_internal) {
    document.body.classList.add('internal');
    document.getElementById('username').textContent += ' (internal)';
  } else {
    document.body.classList.add('external');
    document.getElementById('username').textContent += ' (external)';
  }
})
.catch((e) => {
  console.error(e);
});
