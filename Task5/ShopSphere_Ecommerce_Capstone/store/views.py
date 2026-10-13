from decimal import Decimal
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import Q
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import Product, Order, OrderItem
from .serializers import ProductSerializer, RegisterSerializer, OrderSerializer

@api_view(["GET"])
@permission_classes([AllowAny])
def products(request):
    queryset = Product.objects.all()
    search = request.query_params.get("search", "").strip()
    category = request.query_params.get("category", "").strip()
    if search:
        queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search))
    if category and category.lower() != "all":
        queryset = queryset.filter(category__iexact=category)
    return Response(ProductSerializer(queryset, many=True).data)

@api_view(["GET"])
@permission_classes([AllowAny])
def categories(request):
    return Response(["All"] + list(Product.objects.order_by().values_list("category", flat=True).distinct()))

@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    if request.user.is_authenticated:
        return Response({"authenticated": True, "username": request.user.username, "email": request.user.email})
    return Response({"authenticated": False})

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)
    return Response({"authenticated": True, "username": user.username, "email": user.email}, status=status.HTTP_201_CREATED)

@api_view(["POST"])
@permission_classes([AllowAny])
def sign_in(request):
    username = str(request.data.get("username", "")).strip()
    password = request.data.get("password", "")
    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({"detail": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)
    login(request, user)
    return Response({"authenticated": True, "username": user.username, "email": user.email})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sign_out(request):
    logout(request)
    return Response({"ok": True})

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def orders(request):
    if request.method == "GET":
        return Response(OrderSerializer(request.user.orders.prefetch_related("items"), many=True).data)

    full_name = str(request.data.get("full_name", "")).strip()
    email = str(request.data.get("email", "")).strip()
    address = str(request.data.get("address", "")).strip()
    city = str(request.data.get("city", "")).strip()
    postal_code = str(request.data.get("postal_code", "")).strip()
    raw_items = request.data.get("items", [])

    if not all([full_name, email, address, city, postal_code]):
        return Response({"detail": "Complete all delivery fields."}, status=400)
    if not isinstance(raw_items, list) or not raw_items or len(raw_items) > 50:
        return Response({"detail": "Your cart is empty or contains too many different products."}, status=400)

    quantities = {}
    try:
        for item in raw_items:
            product_id = int(item.get("product_id"))
            quantity = int(item.get("quantity"))
            if quantity < 1 or quantity > 99:
                raise ValueError
            quantities[product_id] = quantities.get(product_id, 0) + quantity
        if any(q > 99 for q in quantities.values()):
            raise ValueError
    except (ValueError, TypeError, AttributeError):
        return Response({"detail": "Invalid cart item data."}, status=400)

    with transaction.atomic():
        products_by_id = {
            p.id: p for p in Product.objects.select_for_update().filter(id__in=quantities)
        }
        if len(products_by_id) != len(quantities):
            return Response({"detail": "One or more products no longer exist."}, status=400)
        for product_id, quantity in quantities.items():
            if products_by_id[product_id].stock < quantity:
                return Response({"detail": f"Not enough stock for {products_by_id[product_id].name}."}, status=400)

        total = sum(
            (products_by_id[pid].price * quantity for pid, quantity in quantities.items()),
            Decimal("0.00")
        )
        order = Order.objects.create(
            user=request.user, full_name=full_name, email=email,
            address=address, city=city, postal_code=postal_code, total=total
        )
        for product_id, quantity in quantities.items():
            product = products_by_id[product_id]
            OrderItem.objects.create(
                order=order, product=product, product_name=product.name,
                quantity=quantity, unit_price=product.price
            )
            product.stock -= quantity
            product.save(update_fields=["stock"])
    return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
