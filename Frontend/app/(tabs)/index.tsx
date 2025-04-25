import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, TextInput, Button, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import * as Calendar from 'expo-calendar';

const EventParserScreen = () => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [calendarPermission, setCalendarPermission] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [messageVisible, setMessageVisible] = useState(new Animated.Value(0));

  useEffect(() => {
    requestCalendarPermission();
  }, []);

  const requestCalendarPermission = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    setCalendarPermission(status === 'granted');
  };

  const fetchCalendarEvents = async () => {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const events = [];
      const now = new Date();
      for (let calendar of calendars) {
        const eventsInCalendar = await Calendar.getEventsAsync([calendar.id], now, new Date(2025, 12, 31));
        events.push(...eventsInCalendar);
      }
      return events;
    } catch (err) {
      setError('Failed to fetch events from calendar');
      return [];
    }
  };

  const parseEvent = async () => {
    setError(null);
    setSuccessMessage('');
    try {
      const events = await fetchCalendarEvents();
      const response = await fetch('https://20ef9df0-7c39-47ea-aa4b-1c777340616e-00-31zx8ha7x0s4g.picard.replit.dev:5000/parse_event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input, events }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Unknown error');
      } else {
        await handleCalendarActions(data);
        setSuccessMessage('✅ Actions completed successfully!');
        showSuccessMessage();
      }
    } catch (err) {
      setError('Failed to connect to the server.');
    }
  };

  const handleCalendarActions = async (result) => {
    if (!calendarPermission) {
      setError('Permission to access calendar is required.');
      return;
    }

    if (result && Array.isArray(result)) {
      for (let event of result) {
        try {
          if (event.action === 'delete') {
            await Calendar.deleteEventAsync(event.id);
            console.log(`Event deleted: ${event.id}`);
          } else if (event.action === 'add') {
            const startDate = new Date(event.start_time);
            const endDate = new Date(event.end_time);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              setError(`Invalid date range for event: ${event.title}`);
              return;
            }

            const newEvent = {
              title: event.title,
              startDate: startDate,
              endDate: endDate,
              location: event.location,
              notes: event.summary,
            };

            const calendarId = await Calendar.getDefaultCalendarAsync();
            await Calendar.createEventAsync(calendarId.id, newEvent);
            console.log(`Event added: ${event.title}`);
          }
        } catch (err) {
          console.error(`Failed to add event: ${event.title}`, err);
          setError(`Failed to add event: ${event.title}`);
        }
      }
    } else {
      setError('No events to process.');
    }
  };

  const showSuccessMessage = () => {
    Animated.timing(messageVisible, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(messageVisible, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 3000);
    });
  };

  const clearInput = () => {
    setInput('');
    setError(null);
    setSuccessMessage('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>🗓️ Event Parser</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter event info (e.g., Delete meeting on May 23)"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <Button title="Clear" onPress={clearInput} color="#e57373" />
        </View>

        <View style={styles.goButtonContainer}>
          <Button title="Go" onPress={parseEvent} color="#007aff" style={styles.goButton} />
        </View>

        <Animated.View style={[styles.successBox, { opacity: messageVisible }]}>
          <Text style={styles.successText}>{successMessage}</Text>
        </Animated.View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {error}</Text>
            {error !== 'Actions completed successfully.' && (
              <Text style={styles.retryText}>Please try again.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f4f7fc',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    marginBottom: 30,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
    fontFamily: 'HelveticaNeue',
  },
  inputContainer: {
    flexDirection: 'column',
    marginBottom: 30,
  },
  input: {
    borderColor: '#007aff',
    borderWidth: 1.5,
    padding: 18,
    borderRadius: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: 'Arial',
    backgroundColor: '#ffffff',
    marginBottom: 15,
  },
  goButtonContainer: {
    marginTop: 10,
    borderRadius: 12,
  },
  goButton: {
    borderRadius: 15,
  },
  successBox: {
    marginTop: 20,
    backgroundColor: '#e1f5e1',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4caf50',
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    marginBottom: 10,
  },
  successText: {
    color: '#4caf50',
    fontWeight: '600',
    fontSize: 18,
    textAlign: 'center',
  },
  errorBox: {
    marginTop: 20,
    backgroundColor: '#ffe6e6',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e57373',
    shadowColor: '#e57373',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  errorText: {
    color: '#e57373',
    fontWeight: '600',
    fontSize: 16,
  },
  retryText: {
    color: '#2196f3',
    fontWeight: '500',
    textDecorationLine: 'underline',
    marginTop: 5,
    fontSize: 14,
  },
});

export default EventParserScreen;
