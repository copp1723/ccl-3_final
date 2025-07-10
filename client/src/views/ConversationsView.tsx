import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Mail, Phone, MessageCircle, Clock } from 'lucide-react';

interface Conversation {
  id: string;
  leadName: string;
  leadEmail: string;
  channel: 'email' | 'sms' | 'chat';
  lastMessage: string;
  lastMessageAt: string;
  status: 'active' | 'pending' | 'closed';
  unreadCount: number;
}

export function ConversationsView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => setConversations(data?.conversations || []))
      .catch(() => setConversations([
        {
          id: '1',
          leadName: 'John Smith',
          leadEmail: 'john@example.com',
          channel: 'email',
          lastMessage: 'Thanks for the information about the loan options.',
          lastMessageAt: '2024-01-15T10:30:00Z',
          status: 'active',
          unreadCount: 2
        },
        {
          id: '2',
          leadName: 'Sarah Johnson',
          leadEmail: 'sarah@example.com',
          channel: 'chat',
          lastMessage: 'Can you help me with the application process?',
          lastMessageAt: '2024-01-15T09:15:00Z',
          status: 'pending',
          unreadCount: 1
        }
      ]));
  }, []);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <Phone className="h-4 w-4" />;
      case 'chat': return <MessageCircle className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Conversations</h2>
        <p className="text-gray-600">Monitor and manage customer interactions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Conversation List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Active Conversations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConversation === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {conv.leadName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-sm truncate">{conv.leadName}</p>
                          {getChannelIcon(conv.channel)}
                        </div>
                        <p className="text-xs text-gray-600 truncate">{conv.lastMessage}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {new Date(conv.lastMessageAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <Badge className={getStatusColor(conv.status)} variant="secondary">
                        {conv.status}
                      </Badge>
                      {conv.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversation Detail */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedConversation 
                ? conversations.find(c => c.id === selectedConversation)?.leadName || 'Conversation'
                : 'Select a conversation'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedConversation ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Conversation details will be implemented here</p>
                  <p className="text-sm">Integration with chat system pending</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a conversation to view details</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}