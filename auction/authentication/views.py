from rest_framework import status, generics, permissions, viewsets, filters
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from .serializers import UserRegistrationSerializer, CustomTokenObtainPairSerializer, UserSerializer, UserProfileSerializer, AdminUserSerializer
from .models import UserProfile


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'message': 'User created successfully. Pending admin approval.',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                }
            },
            status=status.HTTP_201_CREATED
        )


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def put(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.partial_update(request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.partial_update(request, *args, **kwargs)


class UserProfileImageView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        return profile


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('profile').all()
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['date_joined', 'username', 'email']
    ordering = ['username']

    def get_queryset(self):
        qs = super().get_queryset()
        pending = self.request.query_params.get('pending')
        is_active = self.request.query_params.get('is_active')
        if pending is not None:
            # pending=true => is_active False
            if pending.lower() in ('1', 'true', 'yes'):
                qs = qs.filter(is_active=False)
            elif pending.lower() in ('0', 'false', 'no'):
                qs = qs.filter(is_active=True)
        if is_active is not None:
            if is_active.lower() in ('1', 'true', 'yes'):
                qs = qs.filter(is_active=True)
            elif is_active.lower() in ('0', 'false', 'no'):
                qs = qs.filter(is_active=False)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=['is_active'])
        return Response({'status': 'approved'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def deny(self, request, pk=None):
        user = self.get_object()
        user.delete()
        return Response({'status': 'denied'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def request_changes(self, request, pk=None):
        user = self.get_object()
        message = request.data.get('message', '')
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if message:
            note = f"[ADMIN NOTE] {message}\n"
            profile.bio = (note + (profile.bio or ''))[:500]
            profile.save(update_fields=['bio'])
        return Response({'status': 'changes_requested'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def protected_view(request):
    return Response({
        'message': 'Hello, authenticated user!',
        'user': request.user.username
    })
