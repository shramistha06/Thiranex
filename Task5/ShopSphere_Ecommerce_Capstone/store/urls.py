from django.urls import path
from . import views

urlpatterns = [
    path("products/", views.products, name="products"),
    path("categories/", views.categories, name="categories"),
    path("auth/me/", views.me, name="me"),
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.sign_in, name="login"),
    path("auth/logout/", views.sign_out, name="logout"),
    path("orders/", views.orders, name="orders"),
]
