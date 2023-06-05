
async function addAlias(alias) {
  const response = await fetch('/add-alias', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      aliasName: alias,
    }),
  });
  const data = await response.json();
  if (data.error) {
    console.error('Error response:', data);
    document.getElementById('error').textContent = data.error;
  } else {
    renderAliases(data.aliases);
  }
}

async function removeAlias(alias) {
  const response = await fetch('/remove-alias', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      aliasName: alias,
    }),
  });
  const data = await response.json();
  if (data.error) {
    console.error('Error response:', data);
    document.getElementById('error').textContent = data.error;
  } else {
    renderAliases(data.aliases);
  }
}

const aliasesElement = document.getElementById('aliases');
function renderAliases(aliases) {
  aliasesElement.textContent = '';
  for (const alias of aliases) {
    const aliasElement = document.createElement('div');
    const aliasLabel = document.createElement('span');
    aliasLabel.textContent = alias;
    aliasElement.appendChild(aliasLabel);
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.onclick = () => {
      removeAlias(alias).catch((e) => {
        console.error(e);
        const message = String(e.message ?? e);
        document.getElementById('error').textContent = message;
      });
    };
    aliasElement.appendChild(deleteButton);
    aliasesElement.appendChild(aliasElement);
  }
}

const addAliasButton = document.getElementById('add_alias_button');
const addAliasName = document.getElementById('add_alias_name');
addAliasButton.onclick = async () => {
  const alias = addAliasName.value;
  addAliasName.value = '';
  try {
    await addAlias(alias);
  } catch (e) {
    console.error(e);
  }
};

fetch('/get-aliases')
.then(response => response.json())
.then(data => {
  if (data.error) {
    console.error('Error response:', data);
    document.getElementById('error').textContent = data.error;
  } else {
    renderAliases(data.aliases);
  }
})
.catch((e) => {
  console.error(e);
});
