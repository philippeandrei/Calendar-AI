import React, { useState, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  TextInput,
  Button,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  FlatList,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  Modal,
} from 'react-native';
import * as Calendar from 'expo-calendar';
import * as Haptics from 'expo-haptics';
import { ModernButton } from '@/components/ModernButton';
import ColorPicker from '@/components/ColorPicker';
import { useTheme } from '@/context/ThemeContext';

const EventParserScreen = () => {
  const { primaryColor, setPrimaryColor } = useTheme();
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [calendarPermission, setCalendarPermission] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [messageVisible, setMessageVisible] = useState(new Animated.Value(0));
  const [commandType, setCommandType] = useState('add');
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDots, setLoadingDots] = useState('');
  const [stats, setStats] = useState({
    scheduled: 0,
    upcoming: 0,
    completed: 0,
  });
  const [nextImportantEvents, setNextImportantEvents] = useState([]);
  const MAX_SEARCH_RESULTS = 5;
  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const colorOptions = [
    '#007aff', // iOS Blue
    '#34C759', // Green
    '#FF9500', // Orange
    '#FF2D55', // Pink
    '#5856D6', // Purple
    '#FF3B30', // Red
    '#5AC8FA', // Light Blue
    '#AF52DE', // Deep Purple
  ];

  useEffect(() => {
    requestCalendarPermission();
  }, []);

  useEffect(() => {
    if (calendarPermission) {
      fetchCalendarEvents();
    }
  }, [calendarPermission]);

  useEffect(() => {
    filterEvents();
  }, [searchQuery, events]);

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev.length >= 3) return '';
          return prev + '.';
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const requestCalendarPermission = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    setCalendarPermission(status === 'granted');
  };

  const fetchCalendarEvents = async () => {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const now = new Date();
      const end = new Date(2025, 11, 31);
      let allEvents = [];

      for (let calendar of calendars) {
        const eventsInCalendar = await Calendar.getEventsAsync([calendar.id], now, end);
        allEvents.push(...eventsInCalendar);
      }

      allEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      setEvents(allEvents);
      
      // Get next 2 important events
      const upcomingEvents = allEvents.filter(event => new Date(event.startDate) > now);
      setNextImportantEvents(upcomingEvents.slice(0, 2));
      
      updateStats(allEvents);
    } catch (err) {
      showError('Failed to fetch events from calendar');
    }
  };

  const updateStats = (eventsList) => {
    const now = new Date();
    const scheduled = eventsList.length;
    const upcoming = eventsList.filter(event => new Date(event.startDate) > now).length;
    const completed = scheduled - upcoming;
    setStats({ scheduled, upcoming, completed });
  };

  const filterEvents = () => {
    const now = new Date();
    const upcomingEvents = events.filter(event => new Date(event.startDate) > now);
    
    if (searchQuery === '') {
      setFilteredEvents([]);
    } else {
      const filtered = upcomingEvents
        .filter(event => event.title?.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, MAX_SEARCH_RESULTS);
      setFilteredEvents(filtered);
    }
  };

  const showSuccessMessage = () => {
    // Trigger haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
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

  const showError = (errorMessage) => {
    // Trigger haptic feedback for error
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(errorMessage);
  };

  const parseEvent = async () => {
    setError(null);
    setSuccessMessage('');
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const now = new Date();
      const futureEvents = events.filter(event => new Date(event.startDate) > now);

      const response = await fetch('https://20ef9df0-7c39-47ea-aa4b-1c777340616e-00-31zx8ha7x0s4g.picard.replit.dev:5000/parse_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          commandType,
          events: futureEvents.map(event => ({
            id: event.id,
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            location: event.location,
            notes: event.notes,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        showError(data.error || 'Unknown error');
      } else {
        await handleCalendarActions(data);
        setSuccessMessage('✅ Actions completed successfully!');
        showSuccessMessage();
        await fetchCalendarEvents(); // update the event list
      }
    } catch (err) {
      showError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleCalendarActions = async (result) => {
    if (!calendarPermission) {
      showError('Permission to access calendar is required.');
      return;
    }

    if (result && Array.isArray(result)) {
      for (let event of result) {
        try {
          if (event.action === 'delete') {
            await Calendar.deleteEventAsync(event.id);
          } else if (event.action === 'add') {
            const startDate = new Date(event.start_time);
            const endDate = new Date(event.end_time);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              showError(`Invalid date for event: ${event.title}`);
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
          }
        } catch (err) {
          console.error(`Failed for event: ${event.title}`, err);
          showError(`Failed for event: ${event.title}`);
        }
      }
    } else {
      showError('No events to process.');
    }
  };

  const clearInput = () => {
    setInput('');
    setError(null);
    setSuccessMessage('');
  };

  const renderEventItem = ({ item }) => (
    <View style={styles.eventItem}>
      <Text style={styles.eventTitle}>{item.title}</Text>
      <Text style={styles.eventDetails}>
        {new Date(item.startDate).toLocaleString()} - {new Date(item.endDate).toLocaleString()}
      </Text>
      {item.location && <Text style={styles.eventDetails}>Location: {item.location}</Text>}
    </View>
  );

  const getEventEmoji = (title) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('meeting')) return '👥';
    if (lowerTitle.includes('call')) return '📞';
    if (lowerTitle.includes('lunch') || lowerTitle.includes('dinner') || lowerTitle.includes('breakfast')) return '🍽️';
    if (lowerTitle.includes('doctor') || lowerTitle.includes('appointment')) return '👨‍⚕️';
    if (lowerTitle.includes('birthday')) return '🎂';
    if (lowerTitle.includes('party')) return '🎉';
    if (lowerTitle.includes('workout') || lowerTitle.includes('gym')) return '💪';
    if (lowerTitle.includes('shopping')) return '🛍️';
    if (lowerTitle.includes('travel') || lowerTitle.includes('trip')) return '✈️';
    if (lowerTitle.includes('movie') || lowerTitle.includes('cinema')) return '🎬';
    if (lowerTitle.includes('study') || lowerTitle.includes('class')) return '📚';
    if (lowerTitle.includes('interview')) return '💼';
    if (lowerTitle.includes('wedding')) return '💍';
    if (lowerTitle.includes('concert')) return '🎵';
    if (lowerTitle.includes('game')) return '🎮';
    return '📅'; // default emoji
  };

  const getDynamicStyles = () => StyleSheet.create({
    nextEventTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: primaryColor,
      marginBottom: 8,
    },
    buttonText: {
      color: primaryColor,
    },
    inputBorder: {
      borderColor: primaryColor,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
      color: primaryColor,
    },
    statNumber: {
      fontSize: 20,
      fontWeight: 'bold',
      color: primaryColor,
    },
  });

  const renderNextEvents = () => (
    <View style={styles.nextEventsSection}>
      <Text style={styles.sectionTitle}>⏰ Next Important Events</Text>
      {nextImportantEvents.map((event, index) => (
        <View key={event.id} style={styles.nextEventItem}>
          <View style={styles.eventHeader}>
            <View style={styles.emojiContainer}>
              <Text style={styles.eventEmoji}>{getEventEmoji(event.title)}</Text>
            </View>
            <View style={styles.nextEventContent}>
              <Text style={getDynamicStyles().nextEventTitle}>{event.title}</Text>
              <Text style={styles.nextEventTime}>
                {new Date(event.startDate).toLocaleString()} - {new Date(event.endDate).toLocaleString()}
              </Text>
              {event.location && (
                <Text style={styles.nextEventLocation}>📍 {event.location}</Text>
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.container} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: primaryColor }]}>🗓️ Event Parser</Text>
              <TouchableOpacity 
                style={[styles.colorButton, { backgroundColor: primaryColor }]}
                onPress={() => setShowColorPicker(true)}
              />
            </View>

            {renderNextEvents()}

            <View style={styles.inputSection}>
              <TextInput
                style={[styles.input, getDynamicStyles().inputBorder]}
                placeholder={isLoading ? `Processing your request${loadingDots}` : "What would you like to do? E.g., Add meeting at 2pm on Monday"}
                placeholderTextColor="#666"
                value={input}
                onChangeText={setInput}
                multiline
                editable={!isLoading}
              />
              <View style={styles.buttonRow}>
                <ModernButton
                  title="Clear"
                  onPress={clearInput}
                  variant="secondary"
                  disabled={isLoading}
                  color={primaryColor}
                />
                <ModernButton
                  title={isLoading ? "Processing..." : "Submit"}
                  onPress={parseEvent}
                  variant="primary"
                  disabled={isLoading}
                  color={primaryColor}
                />
              </View>
            </View>

            <View style={styles.searchSection}>
              <Text style={getDynamicStyles().sectionTitle}>🔍 Search Events</Text>
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, getDynamicStyles().inputBorder]}
                placeholder="Type to search events..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                  }, 100);
                }}
              />
              {filteredEvents.length > 0 && (
                <Text style={styles.searchResultsText}>
                  Showing {filteredEvents.length} of {events.filter(e => new Date(e.startDate) > new Date()).length} upcoming events
                </Text>
              )}
            </View>

            {filteredEvents.length > 0 && (
              <View style={styles.eventsSection}>
                <Text style={styles.sectionTitle}>Search Results</Text>
                <FlatList
                  data={filteredEvents}
                  keyExtractor={(item) => item.id}
                  renderItem={renderEventItem}
                  scrollEnabled={false}
                />
              </View>
            )}

            <View style={styles.statsSection}>
              <Text style={getDynamicStyles().sectionTitle}>📊 Calendar Stats</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={getDynamicStyles().statNumber}>{stats.scheduled}</Text>
                  <Text style={styles.statLabel}>Events Scheduled</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={getDynamicStyles().statNumber}>{stats.upcoming}</Text>
                  <Text style={styles.statLabel}>Upcoming Tasks</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={getDynamicStyles().statNumber}>{stats.completed}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
              </View>
            </View>

            <Animated.View style={[styles.successBox, { opacity: messageVisible }]}>
              <Text style={styles.successText}>{successMessage}</Text>
            </Animated.View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>❌ {error}</Text>
                <Text style={styles.retryText}>Please try again.</Text>
              </View>
            )}

            <Modal
              visible={showColorPicker}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowColorPicker(false)}
            >
              <TouchableWithoutFeedback onPress={() => setShowColorPicker(false)}>
                <View style={styles.modalOverlay}>
                  <View style={styles.colorPickerContainer}>
                    <Text style={[styles.colorPickerTitle, { color: primaryColor }]}>Choose Theme Color</Text>
                    <ColorPicker
                      onColorSelected={color => {
                        setPrimaryColor(color);
                        setShowColorPicker(false);
                      }}
                      initialColor={primaryColor}
                    />
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 60,
    marginBottom: 12,
    color: '#000',
    borderColor: '#ccc',
  },
  inputLoading: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
    color: '#000',
  },
  commandTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  commandTypeButton: {
    padding: 8,
    backgroundColor: '#eee',
    borderRadius: 6,
  },
  commandTypeButtonActive: {
    backgroundColor: '#007aff',
  },
  commandTypeText: {
    color: '#333',
    fontSize: 14,
  },
  commandTypeTextActive: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchSection: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
    color: '#000',
    borderColor: '#ccc',
  },
  searchResultsText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  eventsSection: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  eventItem: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventDetails: {
    fontSize: 14,
    color: '#555',
  },
  tipsSection: {
    marginBottom: 20,
  },
  tipItem: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tipText: {
    fontSize: 14,
    color: '#555',
  },
  statsSection: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  statBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '30%',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#d4edda',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c3e6cb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successText: {
    color: '#155724',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#f8d7da',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f5c6cb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorText: {
    color: '#721c24',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  nextEventsSection: {
    marginBottom: 20,
  },
  nextEventItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventEmoji: {
    fontSize: 20,
  },
  nextEventContent: {
    flex: 1,
  },
  nextEventTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  nextEventLocation: {
    fontSize: 14,
    color: '#666',
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    height: 400,
  },
  colorPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default EventParserScreen;
