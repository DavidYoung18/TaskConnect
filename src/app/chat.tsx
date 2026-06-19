import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'provider';
  time: string;
}

const initialMessages: Message[] = [
  { id: '1', text: 'Hi! I confirmed your booking for Saturday at 10:00.', sender: 'provider', time: '09:30' },
  { id: '2', text: 'Great, thank you! I have a leaking faucet in the kitchen.', sender: 'me', time: '09:32' },
  { id: '3', text: 'No problem, I will bring the necessary tools. Could you send a photo if possible?', sender: 'provider', time: '09:33' },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');

  const sendMessage = () => {
    if (inputText.trim() === '') return;
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, newMessage]);
    setInputText('');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>B</Text>
          </View>
          <View>
            <Text style={styles.providerName}>Bobur Nazarov</Text>
            <Text style={styles.status}>🟢 Online</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble, 
            item.sender === 'me' ? styles.myMessage : styles.theirMessage
          ]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>{item.time}</Text>
          </View>
        )}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#666"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  backButton: {
    color: '#6c63ff',
    fontSize: 16,
    marginRight: 16,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6c63ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  providerName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  status: {
    color: '#4caf50',
    fontSize: 12,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  myMessage: {
    backgroundColor: '#6c63ff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: '#16213e',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  messageText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    backgroundColor: '#16213e',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6c63ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 18,
  },
});