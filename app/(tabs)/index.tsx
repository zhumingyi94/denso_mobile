import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, Image, View, SafeAreaView, TextInput, TouchableOpacity, ActivityIndicator, Animated, Alert } from 'react-native';
import { Text } from '@/components/Themed';
import Camera01 from '@/assets/svgs/camera-01.svg';
import ThreeDots from '@/assets/svgs/3dots.svg';
import TelegramFill from '@/assets/svgs/telegram-fill.svg';
import Extends from '@/assets/svgs/extends.svg';
import Attachment from '@/assets/svgs/attachment-01.svg';
import Microphone from '@/assets/svgs/microphone-01.svg';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import axios from 'axios';
import * as Speech from 'expo-speech';
import UserAvatar from '@/assets/svgs/avatar.svg';
import { SvgXml } from 'react-native-svg';
import S2TSVG from '@/assets/svgs/S2T.svg';
import Markdown from 'react-native-markdown-display';
import OpenAI from 'openai';
import * as FileSystem from 'expo-file-system';

const openai = new OpenAI({
  apiKey: '',
});

const EmptyState = () => (
  <View style={styles.emptyStateContainer}>
    <Image 
      source={require('@/assets/images/banner3.png')} 
      style={styles.emptyStateBanner}
    />
  </View>
);

const BotMessage = ({ message }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const toggleSpeech = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      if (message.content) {
        setIsSpeaking(true);
        Speech.speak(message.content, {
          language: 'vi',
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      }
    }
  };

  return (
    <View style={styles.botMessageContainer}>
      <View style={styles.botMessageContent}>
        <Markdown style={markdownStyles}>{message.content}</Markdown>
        {message.image && (
          <Image 
            source={typeof message.image === 'string' ? { uri: message.image } : message.image} 
            style={styles.botImage} 
            resizeMode="contain"
          />
        )}
      </View>
      <TouchableOpacity onPress={toggleSpeech} style={styles.s2tButton}>
        <S2TSVG width={120} height={40} fill={isSpeaking ? "#00C49A" : "#FFFFFF"} />
      </TouchableOpacity>
    </View>
  );
};

const UserMessage = ({ message }) => (
  <View style={styles.userMessageContainer}>
    <Text style={styles.userMessageText}>{message.content}</Text>
  </View>
);

export default function VisualGuidelineScreen() {
  const [chatImage, setChatImage] = useState(null);
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const avatarAnimation = useRef(new Animated.Value(0)).current;
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  const takePhoto = async () => {
    // Request both camera and media library permissions
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus.status !== 'granted' || libraryStatus.status !== 'granted') {
      alert('Sorry, we need camera and media library permissions to make this work!');
      return;
    }

    // Show action sheet to choose between camera and gallery
    const { action } = await new Promise((resolve) =>
      Alert.alert(
        'Choose an option',
        'Would you like to take a photo or choose from your gallery?',
        [
          {
            text: 'Take Photo',
            onPress: () => resolve({ action: 'camera' }),
          },
          {
            text: 'Choose from Gallery',
            onPress: () => resolve({ action: 'library' }),
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ action: 'cancel' }),
          },
        ]
      )
    );

    if (action === 'cancel') return;

    let result;
    if (action === 'camera') {
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
        // Remove the aspect property to allow free cropping
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
        // Remove the aspect property to allow free cropping
      });
    }

    if (!result.canceled) {
      setChatImage(result.assets[0].uri);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    await processAudioWithWhisper(uri);
  };

  const processAudioWithWhisper = async (uri) => {
    const apiKey = ''; // Replace with your actual API key
    const apiUrl = 'https://api.openai.com/v1/audio/transcriptions';

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      });
      formData.append('model', 'whisper-1');

      console.log('Sending request to Whisper API...');
      const response = await axios.post(apiUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      console.log('Whisper API response:', response.data);
      setMessage(response.data.text);
    } catch (error) {
      console.error('Error processing audio with Whisper:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
        console.error('Error headers:', error.response.headers);
      } else if (error.request) {
        console.error('Error request:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
    }
  };

 const handleUserQuestion = async (question: string, image: string | null) => {
  setIsLoading(true);
  let botResponse = '';
  let botImage = '';

  // Chuẩn hóa câu hỏi
  const normalizedQuestion = question.toLowerCase().trim();

  // Tạo lịch sử chat để gửi đến API
  const chatContext = chatHistory.map(chat => ({
    role: chat.type === 'user' ? 'user' : 'assistant',
    content: chat.content
  }));

  // Thêm câu hỏi hiện tại vào context
  chatContext.push({ role: 'user', content: question });

  // Xử lý các trường hợp đặc biệt
  switch (true) {
    case normalizedQuestion.includes('kiểm tra') && normalizedQuestion.includes('khắc phục'):
      // ... (giữ nguyên case này)
      break;

    case normalizedQuestion.includes('dng cụ đo') || 
         (normalizedQuestion.includes('nhận biết') && normalizedQuestion.includes('mòn')):
      // ... (giữ nguyên case này)
      break;

    // ... (giữ nguyên các case khác)

    default:
      // Sử dụng GPT-4o API cho các trường hợp không nằm trong switch case
      try {
        const messages = [
          {
            role: "system",
            content: "Bạn là một trợ lý có trình độ chuyên môn cao, chuyên về Công ty Denso, một nhà cung cấp linh kiện ô tô hàng đầu toàn cầu. Bạn được trang bị kiến thức chi tiết về các hoạt động toàn cầu, nhà máy, quy trình sản xuất và sản phẩm của Denso. Vai trò của bạn là cung cấp các câu trả lời chính xác và chuyên sâu về các vấn đề liên quan đến Denso: Khi trả lời câu hỏi, hãy tập trung vào việc cung cấp thông tin chính xác và cập nhật. Luôn cung cấp bối cảnh khi thảo luận về các thuật ngữ hoặc công nghệ cụ thể được sử dụng trong các hoạt động của Denso."
          },
          ...chatContext // Thêm toàn bộ lịch sử chat vào messages
        ];

        if (image) {
          const base64Image = await FileSystem.readAsStringAsync(image, { encoding: FileSystem.EncodingType.Base64 });
          messages.push({
            role: "user",
            content: [
              { type: "text", text: question },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              }
            ],
          });
        }

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          max_tokens: 300,
        });

        botResponse = response.choices[0].message.content || "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này.";
      } catch (error) {
        console.error('Error calling GPT-4o API:', error);
        botResponse = 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
      }
  }

  setChatHistory(prev => [...prev, 
    { type: 'user', content: question, image: image },
    { type: 'bot', content: botResponse, image: botImage }
  ]); 
  setIsLoading(false);
}; 

  const sendMessage = async () => {
    if (message.trim() || chatImage) {
      await handleUserQuestion(message, chatImage);
      setMessage('');
      setChatImage(null);
    }
  };

  const speakBotResponse = async (text) => {
    setIsSpeaking(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(avatarAnimation, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(avatarAnimation, { toValue: 0, duration: 500, useNativeDriver: true })
      ])
    ).start();

    await Speech.speak(text, {
      language: 'en',
      onDone: () => {
        setIsSpeaking(false);
        avatarAnimation.stopAnimation();
        avatarAnimation.setValue(0);
      },
    });
  };

  const renderChatMessage = (chat, index) => (
    <View key={index} style={styles.messageRow}>
      <View style={styles.avatarContainer}>
        {chat.type === 'user' ? (
          <UserAvatar width={30} height={30} />
        ) : (
          <Image 
            source={require('@/assets/images/banner.png')} 
            style={styles.botAvatar}
          />
        )}
      </View>
      <View style={styles.messageContentWrapper}>
        <Text style={styles.avatarName}>
          {chat.type === 'user' ? 'WATER' : 'DENSO VISUAL EXPERT'}
        </Text>
        {chat.image && <Image source={{ uri: chat.image }} style={styles.chatImage} />}
        {chat.type === 'bot' ? (
          <BotMessage message={chat} />
        ) : (
          <UserMessage message={chat} />
        )}
      </View>
    </View>
  ); 

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Extends width={26} height={26} fill="black" />
        <Text style={styles.headerText}>Visual Expert</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={takePhoto}>
            <Camera01 width={30} height={30} fill="#00C49A" />
          </TouchableOpacity>
          <ThreeDots width={26} height={26} fill="black" />
        </View>
      </View>
      <ScrollView 
        style={styles.contentContainer} 
        contentContainerStyle={chatHistory.length === 0 ? styles.emptyContentContainer : null}
      >
        {chatHistory.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {chatHistory.map(renderChatMessage)}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00C49A" />
                <Text style={styles.loadingText}>Đang xử lý...</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {chatImage && (
          <View style={styles.chatImageContainer}>
            <Image source={{ uri: chatImage }} style={styles.chatImage} />
            <TouchableOpacity onPress={() => setChatImage(null)} style={styles.removeImageButton}>
              <Text style={styles.removeImageText}>X</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContainer}>
          <Attachment width={24} height={24}/>
          <TextInput 
            style={styles.input} 
            placeholder="Type a message..."
            placeholderTextColor="#888"
            value={message}
            onChangeText={setMessage}
          />
          <TouchableOpacity onPress={isRecording ? stopRecording : startRecording}>
            {isRecording ? (
              <ActivityIndicator size="small" color="#00C49A" />
            ) : (
              <Microphone width={24} height={24} fill="#03B473" style={styles.microphone}/>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={sendMessage}>
            <TelegramFill width={24} height={24}/>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'black',
    marginTop: 50,
    paddingHorizontal: 16,
  },
  headerText: {
    fontSize: 22,
    color: 'black',
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  expertName: {
    color: 'blue',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepTitle: {
    fontWeight: 'bold',
    color: 'black',
    marginTop: 16,
    marginBottom: 4,
  },
  stepDescription: {
    marginBottom: 8,
    color: 'black',
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    marginVertical: 16,
  },
  footer: {
    padding: 10,
    // Remove the following line to eliminate the upper border
    // borderTopWidth: 1,
    // borderTopColor: '#ccc',
  },
  chatImageContainer: {
    marginBottom: 10,
    position: 'relative',
  },
  chatImage: {
    width: '100%',
    height: 100,
    resizeMode: 'contain',
    borderRadius: 10,
    marginBottom: 10,
  },
  microphone: {
    marginRight: 5,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 5,
    color: 'black', // Add this to ensure text is visible
  },
  sendButton: {
    color: 'blue',
    fontWeight: 'bold',
  },
  takenImage: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  avatarContainer: {
    width: 44,
    marginRight: 8,
    alignItems: 'center',
  },
  messageContentWrapper: {
    flex: 1,
  },
  avatarName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#262CD9',
    marginBottom: 4,
  },
  botMessageContainer: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  botMessageContent: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 5,
  },
  messageText: {
    color: 'black',
    fontSize: 16,
    lineHeight: 20,
  },
  s2tButton: {
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  userMessageContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 10,
    maxWidth: '100%',
  },
  userMessageText: {
    color: 'white',
    fontSize: 16,
    lineHeight: 20,
  },
  botAvatar: {
    width: 44,
    height: 21,
    resizeMode: 'contain',
  },
  emptyContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyStateBanner: {
    width: 600, // Adjust this value as needed/ Adjust this value as needed
    resizeMode: 'contain',
  },
  emptyStateText: {
    marginTop: 20,
    fontSize: 16,
    color: '#888',
  },
  botImage: {
    width: '100%',
    height: 200, // Điều chỉnh chiều cao theo nhu cầu
    marginTop: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#00C49A',
    fontSize: 16,
  },
});

const markdownStyles = {
  body: {
    color: 'black',
    fontSize: 16,
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paragraph: {
    marginBottom: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listItemNumber: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  listItemBullet: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
};