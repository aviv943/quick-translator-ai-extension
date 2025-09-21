const DEFAULT_SETTINGS = {
  targetLanguage: 'English',
  direction: 'ltr',
  apiKey: ''
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve({
        targetLanguage: items.targetLanguage || DEFAULT_SETTINGS.targetLanguage,
        direction: items.direction || DEFAULT_SETTINGS.direction,
        apiKey: items.apiKey || DEFAULT_SETTINGS.apiKey
      });
    });
  });
}

async function setDefaultsIfNeeded() {
  const current = await getSettings();
  if (!current.targetLanguage || !current.direction) {
    chrome.storage.sync.set({
      targetLanguage: current.targetLanguage || DEFAULT_SETTINGS.targetLanguage,
      direction: current.direction || DEFAULT_SETTINGS.direction
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setDefaultsIfNeeded();
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type === 'GET_SETTINGS') {
    getSettings().then((settings) => {
      sendResponse({ success: true, settings });
    });
    return true;
  }

  if (request?.type === 'TRANSLATE_TEXT') {
    (async () => {
      try {
        const { text } = request;
        if (!text || !text.trim()) {
          sendResponse({ success: false, error: 'Nothing to translate.' });
          return;
        }

        const settings = await getSettings();
        if (!settings.apiKey) {
          sendResponse({ success: false, error: 'Add your OpenAI API key in the extension settings.' });
          return;
        }

        const body = {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional translation assistant. Always return only the translated text without additional commentary. Preserve tone and formatting.'
            },
            {
              role: 'user',
              content: `Translate the following text to ${settings.targetLanguage} and keep it concise.\n\n${text}`
            }
          ],
          temperature: 0.2
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Translation request failed:', response.status, errorText);
          let message = 'Translation failed. Check your API key and network connection.';
          if (response.status === 401) {
            message = 'OpenAI rejected the request. Confirm that your API key is correct.';
          } else if (response.status === 429) {
            message = 'The request was rate limited by OpenAI. Try again in a moment.';
          }
          sendResponse({ success: false, error: message });
          return;
        }

        const data = await response.json();
        const translation = data?.choices?.[0]?.message?.content?.trim();
        if (!translation) {
          sendResponse({ success: false, error: 'No translation received. Try again.' });
          return;
        }

        sendResponse({
          success: true,
          translation,
          targetLanguage: settings.targetLanguage,
          direction: settings.direction
        });
      } catch (error) {
        console.error('Unexpected translation error:', error);
        sendResponse({ success: false, error: 'Unexpected error. Try again.' });
      }
    })();
    return true;
  }

  return false;
});
