import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const TaskDescription = ({ description }) => {
  const [webViewHeight, setWebViewHeight] = useState(50); // Start with a small default height

  if (!description) {
    return <Text style={styles.emptyText}>No description available.</Text>;
  }

  const htmlContent = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body {
            padding: 0;
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
            font-size: 16px;
            width: 100%;
          }
          #content {
            width: 80%; /* Set content width to 80% */
            margin: 0 auto; /* Center content */
            padding-bottom: 10px; /* Ensure enough padding at the bottom */
          }
        </style>
      </head>
      <body>
        <div id="content">
          ${description}
        </div>
        <script>
          function updateHeight() {
            const contentHeight = document.body.offsetHeight; // Use offsetHeight for accurate visible content height
            window.ReactNativeWebView.postMessage(contentHeight.toString());
          }

          // Ensure that height is calculated after everything (including images) is loaded
          window.onload = updateHeight;

          // Recalculate height after a short delay to ensure all dynamic content is loaded
          setTimeout(updateHeight, 500);
        </script>
      </body>
    </html>
  `;

  // Handle the message from the WebView to set the height
  const onMessage = (event) => {
    const height = parseInt(event.nativeEvent.data, 10);
    if (!isNaN(height) && height > 0) {
      setWebViewHeight(height); // Update WebView height dynamically
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={[styles.webview, { height: webViewHeight }]} // Dynamic height
        injectedJavaScript={htmlContent}
        onMessage={onMessage}
        scrollEnabled={false} // Disable WebView scrolling
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: Dimensions.get('window').width - 40,
    marginVertical: 5,
  },
  webview: {
    width: '80%', // Set WebView width to 80%
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#666',
  },
});

export default TaskDescription;
