class User < ActiveRecord::Base
  # Include default devise modules.
  devise :database_authenticatable, :registerable,
          :trackable, :validatable
  include DeviseTokenAuth::Concerns::User

  has_many :songs, inverse_of: :user
  has_many :comments, inverse_of: :user
end
