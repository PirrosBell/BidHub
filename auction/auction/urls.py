"""
URL configuration for auction project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api-auth/', include('rest_framework.urls')),
    path('api/auth/', include('authentication.urls')),
    path('api/', include('bids.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

"""
/items - List all items 
/items/<pk:id>/ - Retrieve, update, or delete a specific item
/items/create_item/ - Create a new item
/items/<pk:id>/bids/ - List all bids for a specific item
/items/<pk:id>/bids/create_bid/ - Create a new bid for a specific item
/items/<pk:id>/bids/<bid_id>/ - Retrieve or delete a specific bid

/users/
/users/register/ - Register a new user
/users/login/ - Login a user
/users/<pk:id>/ - Retrieve or delete a specific user
/users/<pk:id>/bids/ - List all bids made by a specific user
/users/<pk:id>/items/ - List all items listed by a specific user

/categories/ - List all categories
/categories/<pk:id>/ - Retrieve, update, or delete a specific category
/categories/<pk:id>/items/ - List all items in a specific category

/locations/ - List all locations
/locations/<pk:id>/ - Retrieve, update, or delete a specific location
/locations/<pk:id>/items/ - List all items in a specific location
"""