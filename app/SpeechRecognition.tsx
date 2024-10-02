import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const html = `
<!DOCTYPE html>
<html>
<body>
  <script>
    var recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
      var result = event.results[0][0].transcript;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'result', text: result }));
    };

    recognition.onerror = function(event) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: event.error }));
    };

    window.startRecognition = function() {
      recognition.start();
    }

    window.stopRecognition = function() {
      recognition.stop();
    }
  </script>
</body>
</html>
`;

interface SpeechRecognitionProps {
  onResult: (text: string) => void;
  onError: (error: string) => void;
}

const SpeechRecognition: React.FC<SpeechRecognitionProps> = ({ onResult, onError }) => {
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'result') {
      onResult(data.text);
    } else if (data.type === 'error') {
      onError(data.error);
    }
  };

  const startRecognition = () => {
    webViewRef.current?.injectJavaScript('window.startRecognition()');
  };

  const stopRecognition = () => {
    webViewRef.current?.injectJavaScript('window.stopRecognition()');
  };

  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, []);

  return (
    <View style={{ height: 0, width: 0 }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
      />
    </View>
  );
};

export default SpeechRecognition;
