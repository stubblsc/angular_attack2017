Rails.application.routes.draw do
  namespace :api do
    resources :comments, except: [:index, :delete]
    get 'index/:id', to: 'comments#index'

    resources :songs, except: [:delete]

    mount_devise_token_auth_for 'User', at: 'auth'

    get 'users/:user_id/songs', to: 'users#songs'
  end
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
