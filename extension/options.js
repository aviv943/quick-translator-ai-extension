document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form');
  const apiKeyInput = document.getElementById('apiKey');
  const targetLanguageInput = document.getElementById('targetLanguage');
  const directionSelect = document.getElementById('direction');
  const status = document.getElementById('status');

  chrome.storage.sync.get(
    {
      apiKey: '',
      targetLanguage: 'English',
      direction: 'ltr'
    },
    (items) => {
      apiKeyInput.value = items.apiKey || '';
      targetLanguageInput.value = items.targetLanguage || 'English';
      directionSelect.value = items.direction || 'ltr';
    }
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const apiKey = apiKeyInput.value.trim();
    const targetLanguage = targetLanguageInput.value.trim() || 'English';
    const direction = directionSelect.value;

    chrome.storage.sync.set(
      {
        apiKey,
        targetLanguage,
        direction
      },
      () => {
        status.textContent = 'Settings saved.';
        status.style.color = '#16a34a';
        setTimeout(() => {
          status.textContent = '';
        }, 2500);
      }
    );
  });

  targetLanguageInput.addEventListener('change', () => {
    const value = targetLanguageInput.value.trim().toLowerCase();
    const rtlLanguages = ['arabic', 'hebrew', 'farsi', 'persian', 'urdu'];
    if (rtlLanguages.includes(value)) {
      directionSelect.value = 'rtl';
    }
  });
});
