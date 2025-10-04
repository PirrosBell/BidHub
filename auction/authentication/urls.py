from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomTokenObtainPairView, UserRegistrationView, UserProfileView, UserProfileImageView, protected_view, AdminUserViewSet

router = DefaultRouter()
router.register(r'admin/users', AdminUserViewSet, basename='admin-users')

urlpatterns = [
    path('register/', UserRegistrationView.as_view(), name='user_register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='user_login'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('profile/image/', UserProfileImageView.as_view(), name='user_profile_image'),
    path('protected/', protected_view, name='protected_view'),
    path('', include(router.urls)),
]
